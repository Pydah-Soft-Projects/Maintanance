const { masterPool } = require('../config/database');
const { normalizeTicketPermissions } = require('../utils/permissions');

const ROLE_PERMISSION_MODULES = {
    ticket_dashboard: ['read'],
    ticket_management: ['read', 'pending', 'assigned', 'resolved', 'student', 'faculty', 'write', 'update', 'delete'],
    category_management: ['read', 'write', 'update', 'delete'],
    employee_management: ['read', 'users', 'roles', 'write', 'update', 'delete']
};

const normalizeRolePermissions = (permissions) => {
    const source = permissions && typeof permissions === 'object' ? permissions : {};
    return normalizeTicketPermissions(Object.fromEntries(
        Object.entries(ROLE_PERMISSION_MODULES).map(([module, actions]) => [
            module,
            Object.fromEntries(actions.map(action => [
                action,
                source[module]?.[action] === undefined
                    ? (action !== 'roles' && source[module]?.read === true)
                    : source[module][action] === true
            ]))
        ])
    ));
};

const EXCLUDED_EXTERNAL_ROLES = [
    'branch_hod',
    'college_ao',
    'college_principal',
    'office_assistant',
    'cashier',
    'faculty',
    'head_student_clubs',
    'pydah_coe',
    'student'
];

/**
 * Get all roles (system and custom)
 */
exports.getRoles = async (req, res) => {
    try {
        const { include_inactive } = req.query;

        let query = `
            SELECT 
                r.id,
                r.role_name,
                r.display_name,
                r.description,
                r.permissions,
                r.is_system_role,
                r.is_active,
                r.created_at,
                r.updated_at,
                creator.name as created_by_name,
                (
                    SELECT COUNT(*) 
                    FROM users
                    WHERE role_id = r.id AND is_ticket_employee = 1 AND is_active = 1
                ) as employee_count
            FROM roles r
            LEFT JOIN users creator ON r.created_by = creator.id
            WHERE r.role_name NOT IN (?)
        `;

        const params = [EXCLUDED_EXTERNAL_ROLES];

        if (!include_inactive || include_inactive === 'false') {
            query += ' AND r.is_active = 1';
        }

        query += ' ORDER BY r.is_system_role DESC, r.created_at DESC';

        const [roles] = await masterPool.query(query, params);

        // Parse JSON permissions
        const rolesWithParsedPermissions = roles.map(role => ({
            ...role,
            permissions: normalizeRolePermissions(
                typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
            )
        }));

        res.json({
            success: true,
            data: rolesWithParsedPermissions
        });
    } catch (error) {
        console.error('Get Roles Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching roles'
        });
    }
};

/**
 * Get single role by ID
 */
exports.getRole = async (req, res) => {
    try {
        const { id } = req.params;

        const [roles] = await masterPool.query(
            `SELECT 
                r.*,
                creator.name as created_by_name
             FROM roles r
             LEFT JOIN users creator ON r.created_by = creator.id
             WHERE r.id = ?`,
            [id]
        );

        if (roles.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        const role = {
            ...roles[0],
            permissions: normalizeRolePermissions(
                typeof roles[0].permissions === 'string' ? JSON.parse(roles[0].permissions) : roles[0].permissions
            )
        };

        res.json({
            success: true,
            data: role
        });
    } catch (error) {
        console.error('Get Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching role'
        });
    }
};

/**
 * Create new custom role
 */
exports.createRole = async (req, res) => {
    try {
        const { role_name, display_name, description, permissions } = req.body;
        const currentUser = req.user;

        // Validation
        if (!role_name || !display_name || !permissions) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: role_name, display_name, permissions'
            });
        }

        // Validate role_name format (lowercase, underscores only)
        if (!/^[a-z_]+$/.test(role_name)) {
            return res.status(400).json({
                success: false,
                message: 'Role name must be lowercase with underscores only (e.g., principal, ticket_manager)'
            });
        }

        // Check for duplicate role_name
        const [existing] = await masterPool.query(
            'SELECT id FROM roles WHERE role_name = ?',
            [role_name]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Role name already exists'
            });
        }

        const normalizedPermissions = normalizeRolePermissions(permissions);

        // Insert role
        const [result] = await masterPool.query(
            `INSERT INTO roles
            (role_name, display_name, description, permissions, is_system_role, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, FALSE, ?, NOW(), NOW())`,
            [
                role_name,
                display_name,
                description || null,
                JSON.stringify(normalizedPermissions),
                currentUser.id
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: {
                id: result.insertId,
                role_name,
                display_name,
                permissions: normalizedPermissions
            }
        });
    } catch (error) {
        console.error('Create Role Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating role'
        });
    }
};

/**
 * Update existing role
 */
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, display_name, description, permissions, is_active } = req.body;

        // Check if role exists
        const [existing] = await masterPool.query(
            'SELECT is_system_role FROM roles WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Allow editing all roles (including system roles)
        // Build update query dynamically
        const updates = [];
        const values = [];

        if (role_name !== undefined) {
            // Validate role_name format
            if (!/^[a-z_]+$/.test(role_name)) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name must be lowercase with underscores only'
                });
            }

            // Check for duplicate role_name (excluding current role)
            const [duplicate] = await masterPool.query(
                'SELECT id FROM roles WHERE role_name = ? AND id != ?',
                [role_name, id]
            );

            if (duplicate.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Role name already exists'
                });
            }

            updates.push('role_name = ?');
            values.push(role_name);
        }

        if (display_name !== undefined) {
            updates.push('display_name = ?');
            values.push(display_name);
        }

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }

        if (permissions !== undefined) {
            updates.push('permissions = ?');
            values.push(JSON.stringify(normalizeRolePermissions(permissions)));
        }

        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await masterPool.query(
            `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Role updated successfully'
        });
    } catch (error) {
        console.error('Update Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating role'
        });
    }
};

/**
 * Delete role (prevent deletion of super_admin role, allow deleting all other roles)
 */
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if role exists
        const [existing] = await masterPool.query(
            'SELECT is_system_role, role_name, display_name FROM roles WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        const role = existing[0];

        // Superadmin cannot be deleted under any circumstances
        if (role.role_name === 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'The Super Administrator role is protected and cannot be deleted.'
            });
        }

        // Check if role is assigned to any active employees
        const [employees] = await masterPool.query(
            'SELECT COUNT(*) as count FROM users WHERE role_id = ? AND is_ticket_employee = 1 AND is_active = 1',
            [id]
        );

        if (employees[0].count > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete role "${role.display_name}". ${employees[0].count} active employee(s) are currently assigned to this role.`
            });
        }

        // Soft delete
        await masterPool.query(
            'UPDATE roles SET is_active = 0, updated_at = NOW() WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: `Role "${role.display_name}" deleted successfully`
        });
    } catch (error) {
        console.error('Delete Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting role'
        });
    }
};

/**
 * Get available modules and their permissions structure
 * (Helper endpoint for frontend to build permission UI)
 */
exports.getModulesStructure = async (req, res) => {
    try {
        const modules = {
            ticket_dashboard: {
                label: 'Dashboard',
                permissions: {
                    read: 'View Dashboard'
                }
            },
            ticket_management: {
                label: 'Task Management',
                permissions: {
                    read: 'Open Task Management',
                    pending: 'View Pending tab',
                    assigned: 'View Assigned / In Progress tab',
                    resolved: 'View Resolved tab',
                    student: 'View Student requests',
                    faculty: 'View Faculty requests',
                    write: 'Create Tasks',
                    update: 'Update Tasks (Status, Assignments)',
                    delete: 'Delete Tasks'
                }
            },
            category_management: {
                label: 'Configuration',
                permissions: {
                    read: 'View Categories & SLAs',
                    write: 'Create Categories',
                    update: 'Update Categories',
                    delete: 'Delete Categories'
                }
            },
            employee_management: {
                label: 'User Management',
                permissions: {
                    read: 'Open User Management',
                    users: 'View Users tab',
                    roles: 'View Roles tab',
                    write: 'Create Users',
                    update: 'Update Users',
                    delete: 'Remove Users'
                }
            }
        };

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        console.error('Get Modules Structure Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
