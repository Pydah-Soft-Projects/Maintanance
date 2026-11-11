const { masterPool } = require('../config/database');
const { getHRMSConnection } = require('../config/mongoConfig');
const { getModel: getHRMSEmployeeModel } = require('../models/HRMSEmployee');
const { mergePermissions } = require('../utils/permissions');
const bcrypt = require('bcryptjs');

const syncWorkerServiceGroups = async (pool, userId, roleName, serviceGroupIds) => {
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    const currentRole = users[0]?.role;
    const [currentGroups] = await pool.query(
        `SELECT gm.group_id
         FROM approval_service_group_members gm
         JOIN approval_service_groups g ON g.id = gm.group_id
         WHERE gm.user_id = ? AND g.member_type = 'worker'`,
        [userId]
    );
    const currentIds = currentGroups.map((group) => Number(group.group_id));
    const targetIds = roleName === 'worker' ? serviceGroupIds : [];
    const removedIds = currentIds.filter((id) => !targetIds.includes(id));

    if (removedIds.length || currentRole !== roleName) {
        const [pendingApprovals] = await pool.query(
            `SELECT COUNT(*) AS count
             FROM complaint_approval_step_members sm
             JOIN complaint_approval_steps s ON s.id = sm.step_id AND s.state = 'pending'
             JOIN complaint_approval_instances i ON i.id = s.instance_id AND i.state = 'pending'
             WHERE sm.user_id = ?`,
            [userId]
        );
        if (Number(pendingApprovals[0].count) > 0) {
            const error = new Error('This Worker has pending approvals and cannot be removed from service types yet');
            error.statusCode = 409;
            throw error;
        }
    }

    if (removedIds.length) {
        await pool.query(
            'DELETE FROM approval_service_group_members WHERE user_id = ? AND group_id IN (?)',
            [userId, removedIds]
        );
    }

    if (targetIds.length) {
        await pool.query(
            'INSERT IGNORE INTO approval_service_group_members (group_id, user_id) VALUES ?',
            [targetIds.map((groupId) => [groupId, userId])]
        );
    }
};

const parseJson = (value, fallback = []) => {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Invalid JSON stored for user:', error.message);
        return fallback;
    }
};

exports.getEmployees = async (_req, res) => {
    try {
        const [employees] = await masterPool.query(`
            SELECT u.id, u.id AS rbac_user_id, u.name, u.username, u.email, u.phone,
                   u.role, u.role_id AS custom_role_id, u.permissions AS user_permissions,
                   u.is_active, u.assigned_categories, u.assigned_subcategories,
                   u.created_at, u.updated_at, u.hrms_id,
                   r.display_name AS role_display_name, r.permissions AS role_permissions,
                   (
                       SELECT COUNT(DISTINCT c.id)
                       FROM complaints c,
                       JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                           assigned_to INT PATH '$.assigned_to',
                           assignment_active BOOLEAN PATH '$.is_active'
                       )) a
                       WHERE a.assigned_to = u.id AND a.assignment_active = TRUE
                         AND c.status NOT IN ('closed', 'completed')
                   ) AS active_tickets_count
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.is_ticket_employee = 1 AND u.is_active = 1
            ORDER BY u.created_at DESC
        `);
        const [serviceGroups] = await masterPool.query(`
            SELECT gm.user_id, g.id AS group_id, g.service_type
            FROM approval_service_group_members gm
            JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
            JOIN users u ON u.id = gm.user_id AND u.is_active = 1
              AND u.is_ticket_employee = 1 AND u.role = 'worker'
            WHERE g.member_type = 'worker'
            ORDER BY g.service_type
        `);
        const serviceGroupsByUser = new Map();
        serviceGroups.forEach(({ user_id, group_id, service_type }) => {
            const existing = serviceGroupsByUser.get(Number(user_id)) || { ids: [], names: [] };
            existing.ids.push(Number(group_id));
            existing.names.push(service_type);
            serviceGroupsByUser.set(Number(user_id), existing);
        });
        res.json({
            success: true,
            data: employees.map((employee) => ({
                ...employee,
                service_group_ids: serviceGroupsByUser.get(Number(employee.id))?.ids || [],
                service_types: serviceGroupsByUser.get(Number(employee.id))?.names || [],
                assigned_categories: parseJson(employee.assigned_categories),
                assigned_subcategories: parseJson(employee.assigned_subcategories),
                user_permissions: parseJson(employee.user_permissions, null),
                role_permissions: parseJson(employee.role_permissions, null),
                effective_permissions: mergePermissions(employee.role_permissions, employee.user_permissions)
            }))
        });
    } catch (error) {
        console.error('Get Employees Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching employees' });
    }
};

/**
 * Live search against HRMS MongoDB.
 * Does NOT write or store any users in MySQL database.
 */
exports.getHrmsEmployees = async (req, res) => {
    try {
        const conn = getHRMSConnection();
        if (!conn) {
            return res.status(503).json({ success: false, message: 'HRMS database connection is unavailable' });
        }
        await conn.asPromise();
        const HRMSEmployee = getHRMSEmployeeModel(conn);

        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        const filter = { is_active: { $ne: false } };
        if (search) {
            filter.$or = [
                { emp_no: { $regex: search, $options: 'i' } },
                { employee_name: { $regex: search, $options: 'i' } },
                { phone_number: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await HRMSEmployee.find(filter)
            .select('emp_no employee_name email phone_number')
            .sort({ employee_name: 1 })
            .limit(100)
            .lean()
            .exec();

        const hrmsIds = employees.map(e => e._id.toString());
        const empNos = employees.map(e => String(e.emp_no || '').toLowerCase().trim()).filter(Boolean);

        // Check which ones are already registered in maintenance_db.users
        const [existingUsers] = await masterPool.query(`
            SELECT id, hrms_id, username, name, role
            FROM users
            WHERE is_active = 1
              AND (
                  (hrms_id IS NOT NULL AND hrms_id IN (?))
                  OR (username IN (?))
              )
        `, [hrmsIds.length ? hrmsIds : [''], empNos.length ? empNos : ['']]);

        const existingHrmsMap = new Map();
        const existingUsernameMap = new Map();
        for (const u of existingUsers) {
            if (u.hrms_id) existingHrmsMap.set(String(u.hrms_id), u);
            if (u.username) existingUsernameMap.set(String(u.username).toLowerCase(), u);
        }

        const result = employees.map(emp => {
            const hrmsId = emp._id.toString();
            const username = String(emp.emp_no || '').toLowerCase().trim();
            const existing = existingHrmsMap.get(hrmsId) || existingUsernameMap.get(username);

            return {
                id: hrmsId,
                hrms_id: hrmsId,
                emp_no: emp.emp_no,
                employee_no: emp.emp_no,
                employee_name: emp.employee_name,
                name: emp.employee_name,
                email: emp.email || '',
                phone: emp.phone_number || '',
                is_already_added: Boolean(existing),
                existing_user_id: existing?.id || null,
                existing_role: existing?.role || null
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get HRMS Employees Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching HRMS employees' });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        const {
            hrms_employee_id,
            hrms_id,
            hrms_employee_no,
            employee_no,
            name,
            username,
            email,
            phone,
            password,
            role,
            custom_role_id,
            assigned_categories,
            assigned_subcategories,
            service_group_ids = []
        } = req.body;

        const targetHrmsId = hrms_employee_id || hrms_id;
        const targetEmpNo = hrms_employee_no || employee_no;

        let roleName = role || 'worker';
        if (custom_role_id) {
            const [roles] = await masterPool.query(
                'SELECT role_name FROM roles WHERE id = ? AND is_active = 1',
                [custom_role_id]
            );
            if (!roles.length) return res.status(404).json({ success: false, message: 'Role not found or inactive' });
            roleName = roles[0].role_name;
        }
        if (typeof roleName !== 'string' || !roleName.trim()) {
            return res.status(400).json({ success: false, message: 'Select an active maintenance role' });
        }
        if (!Array.isArray(service_group_ids) ||
            service_group_ids.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0) ||
            (roleName !== 'worker' && service_group_ids.length > 0)) {
            return res.status(400).json({ success: false, message: 'Service types can only be assigned to Workers' });
        }
        const normalizedServiceGroupIds = [...new Set(service_group_ids.map(Number))];
        if (roleName === 'worker') {
            const [serviceGroups] = await masterPool.query(
                `SELECT id FROM approval_service_groups
                 WHERE id IN (?) AND member_type = 'worker' AND is_active = 1`,
                [normalizedServiceGroupIds.length ? normalizedServiceGroupIds : [0]]
            );
            if (serviceGroups.length !== normalizedServiceGroupIds.length) {
                return res.status(400).json({ success: false, message: 'Select valid Worker service types' });
            }
            if (!normalizedServiceGroupIds.length) {
                return res.status(400).json({ success: false, message: 'Assign at least one service type to a Worker' });
            }
        }
        if (['sub_admin', 'super_admin'].includes(roleName) && req.user?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only a Superadmin can assign administrative roles' });
        }
        const [canonicalRoles] = await masterPool.query(
            'SELECT id FROM roles WHERE role_name = ? AND is_active = 1',
            [roleName]
        );
        if (!canonicalRoles.length) {
            return res.status(409).json({ success: false, message: `The ${roleName} role is not configured` });
        }
        const roleId = canonicalRoles[0].id;

        // Branch 1: User provisioned from HRMS connection
        if (targetHrmsId || targetEmpNo) {
            const conn = getHRMSConnection();
            if (!conn) {
                return res.status(503).json({ success: false, message: 'HRMS connection is unavailable' });
            }
            await conn.asPromise();
            const HRMSEmployee = getHRMSEmployeeModel(conn);

            const hrmsEmp = targetHrmsId
                ? await HRMSEmployee.findById(targetHrmsId).lean()
                : await HRMSEmployee.findOne({ emp_no: targetEmpNo }).lean();

            if (!hrmsEmp) {
                return res.status(404).json({ success: false, message: 'HRMS employee not found' });
            }

            const hrmsIdStr = hrmsEmp._id.toString();
            const empNoStr = String(hrmsEmp.emp_no || targetEmpNo).trim();
            const userType = roleName === 'super_admin' ? 'admin' : 'staff';
            const displayName = (name && name.trim()) || hrmsEmp.employee_name || empNoStr;
            const empEmail = (email && email.trim()) || hrmsEmp.email || null;
            const empPhone = (phone && phone.trim()) || hrmsEmp.phone_number || null;

            // Check if already in maintenance_db.users
            const [existing] = await masterPool.query(
                'SELECT id, is_active FROM users WHERE hrms_id = ? OR username = ? LIMIT 1',
                [hrmsIdStr, empNoStr]
            );

            if (existing.length > 0) {
                const user = existing[0];
                if (user.is_active) {
                    return res.status(409).json({ success: false, message: 'This employee is already registered in the ticket system' });
                }
                await syncWorkerServiceGroups(masterPool, user.id, roleName, normalizedServiceGroupIds);
                // Reactivate and update
                await masterPool.query(`
                    UPDATE users
                    SET is_active = 1, is_ticket_employee = 1, user_type = ?, name = ?, role = ?, role_id = ?,
                        hrms_id = ?, email = COALESCE(?, email), phone = COALESCE(?, phone), permissions = NULL,
                        assigned_categories = ?, assigned_subcategories = ?, updated_at = NOW()
                    WHERE id = ?
                `, [
                    userType,
                    displayName,
                    roleName,
                    roleId,
                    hrmsIdStr,
                    empEmail,
                    empPhone,
                    JSON.stringify(assigned_categories || []),
                    JSON.stringify(assigned_subcategories || []),
                    user.id
                ]);
                return res.status(200).json({
                    success: true,
                    message: 'User activated in ticket system',
                    data: { id: user.id, username: empNoStr, role: roleName }
                });
            }

            // Insert ONLY this single employee into maintenance_db.users
            const [insertResult] = await masterPool.query(`
                INSERT INTO users (
                    user_type, name, username, email, phone, password_hash,
                    role, role_id, hrms_id, permissions, assigned_categories,
                    assigned_subcategories, is_ticket_employee, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, 1, 1, NOW(), NOW())
            `, [
                userType,
                displayName,
                empNoStr,
                empEmail,
                empPhone,
                roleName,
                roleId,
                hrmsIdStr,
                JSON.stringify(assigned_categories || []),
                JSON.stringify(assigned_subcategories || [])
            ]);
            await syncWorkerServiceGroups(masterPool, insertResult.insertId, roleName, normalizedServiceGroupIds);

            return res.status(201).json({
                success: true,
                message: 'HRMS employee registered in ticket system',
                data: { id: insertResult.insertId, username: empNoStr, role: roleName }
            });
        }

        // Branch 2: Local direct user creation (fallback for local accounts)
        if (!name?.trim() || !username?.trim()) {
            return res.status(400).json({ success: false, message: 'Name and username are required' });
        }
        const trimmedUsername = username.trim();
        const trimmedEmail = email?.trim() || null;

        const [existing] = await masterPool.query(
            'SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)',
            [trimmedUsername, trimmedEmail]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'A user with this username or email already exists' });
        }

        const passwordHash = password ? await bcrypt.hash(password, 10) : null;
        const userType = roleName === 'super_admin' ? 'admin' : 'staff';

        const [insertResult] = await masterPool.query(`
            INSERT INTO users (
                user_type, name, username, email, phone, password_hash,
                role, role_id, permissions, assigned_categories, assigned_subcategories,
                is_ticket_employee, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, 1, NOW(), NOW())
        `, [
            userType,
            name.trim(),
            trimmedUsername,
            trimmedEmail,
            phone?.trim() || null,
            passwordHash,
            roleName,
            roleId,
            JSON.stringify(assigned_categories || []),
            JSON.stringify(assigned_subcategories || [])
        ]);
        await syncWorkerServiceGroups(masterPool, insertResult.insertId, roleName, normalizedServiceGroupIds);

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { id: insertResult.insertId, username: trimmedUsername, role: roleName }
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Server error creating user' });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            role,
            custom_role_id,
            assigned_categories,
            assigned_subcategories,
            service_group_ids = []
        } = req.body;
        const employeeId = Number(req.params.id);
        if (!Number.isInteger(employeeId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

        const [currentUsers] = await masterPool.query(
            'SELECT role_id, role FROM users WHERE id = ? AND is_ticket_employee = 1',
            [employeeId]
        );
        if (!currentUsers.length) return res.status(404).json({ success: false, message: 'Ticket user not found' });
        if (['sub_admin', 'super_admin'].includes(currentUsers[0].role) &&
            req.user?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only a Superadmin can manage administrative accounts' });
        }

        let roleName = role;
        if (custom_role_id) {
            const [roles] = await masterPool.query(
                'SELECT role_name FROM roles WHERE id = ? AND is_active = 1',
                [custom_role_id]
            );
            if (!roles.length) return res.status(404).json({ success: false, message: 'Role not found or inactive' });
            roleName = roles[0].role_name;
        }
        if (!Array.isArray(service_group_ids) ||
            service_group_ids.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
            return res.status(400).json({ success: false, message: 'Select valid Worker service types' });
        }
        const normalizedServiceGroupIds = [...new Set(service_group_ids.map(Number))];
        if (['sub_admin', 'super_admin'].includes(roleName) && req.user?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only a Superadmin can assign administrative roles' });
        }
        let roleId = currentUsers[0].role_id;
        if (roleName !== undefined) {
            const [canonicalRoles] = await masterPool.query(
                'SELECT id FROM roles WHERE role_name = ? AND is_active = 1',
                [roleName]
            );
            if (!canonicalRoles.length) {
                return res.status(409).json({ success: false, message: `The ${roleName} role is not configured` });
            }
            roleId = canonicalRoles[0].id;
        }
        const targetRole = roleName || currentUsers[0].role;
        if (targetRole !== 'worker' && normalizedServiceGroupIds.length) {
            return res.status(400).json({ success: false, message: 'Service types can only be assigned to Workers' });
        }
        if (targetRole === 'worker') {
            if (!normalizedServiceGroupIds.length) {
                return res.status(400).json({ success: false, message: 'Assign at least one service type to a Worker' });
            }
            const [serviceGroups] = await masterPool.query(
                `SELECT id FROM approval_service_groups
                 WHERE id IN (?) AND member_type = 'worker' AND is_active = 1`,
                [normalizedServiceGroupIds]
            );
            if (serviceGroups.length !== normalizedServiceGroupIds.length) {
                return res.status(400).json({ success: false, message: 'Select valid Worker service types' });
            }
        }

        const updates = ['name = COALESCE(NULLIF(?, ""), name)'];
        const params = [name || ''];

        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email ? email.trim() : null);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone ? phone.trim() : null);
        }
        if (password && password.trim()) {
            const passwordHash = await bcrypt.hash(password.trim(), 10);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }
        if (roleName) {
            updates.push('role = ?');
            params.push(roleName);
            updates.push('user_type = ?');
            params.push(roleName === 'super_admin' ? 'admin' : 'staff');
        }
        if (custom_role_id !== undefined || role !== undefined) {
            updates.push('role_id = ?');
            params.push(roleId);
        }
        if (assigned_categories !== undefined) {
            updates.push('assigned_categories = ?');
            params.push(JSON.stringify(assigned_categories || []));
        }
        if (assigned_subcategories !== undefined) {
            updates.push('assigned_subcategories = ?');
            params.push(JSON.stringify(assigned_subcategories || []));
        }
        updates.push('permissions = NULL');

        updates.push('updated_at = NOW()');
        params.push(employeeId);

        await syncWorkerServiceGroups(masterPool, employeeId, targetRole, normalizedServiceGroupIds);
        const [result] = await masterPool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND is_ticket_employee = 1`,
            params
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Ticket user not found' });
        res.json({ success: true, message: 'Ticket user updated' });
    } catch (error) {
        console.error('Update Employee Error:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Server error updating ticket user' });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const [employee] = await masterPool.query(
            'SELECT id, role FROM users WHERE id = ? AND is_ticket_employee = 1',
            [req.params.id]
        );
        if (!employee.length) return res.status(404).json({ success: false, message: 'Ticket user not found' });
        if (employee[0].role === 'super_admin') {
            return res.status(403).json({ success: false, message: 'Superadmin accounts cannot be removed' });
        }
        if (employee[0].role === 'sub_admin' && req.user?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only a Superadmin can remove Sub-admin accounts' });
        }
        const [pendingApprovals] = await masterPool.query(
            `SELECT COUNT(*) AS count
             FROM complaint_approval_step_members sm
             JOIN complaint_approval_steps s ON s.id = sm.step_id AND s.state = 'pending'
             JOIN complaint_approval_instances i ON i.id = s.instance_id AND i.state = 'pending'
             WHERE sm.user_id = ?`,
            [employee[0].id]
        );
        if (Number(pendingApprovals[0].count) > 0) {
            return res.status(409).json({ success: false, message: 'Users assigned to pending approvals cannot be removed' });
        }
        if (employee[0].role === 'worker') {
            await syncWorkerServiceGroups(masterPool, employee[0].id, null, []);
        }
        const [result] = await masterPool.query(
            `UPDATE users SET is_active = 0, is_ticket_employee = 0, role_id = NULL,
             assigned_categories = NULL, assigned_subcategories = NULL,
             permissions = NULL, updated_at = NOW()
             WHERE id = ? AND is_ticket_employee = 1`,
            [req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Ticket user not found' });
        res.json({ success: true, message: 'Ticket access removed' });
    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({ success: false, message: 'Server error removing ticket access' });
    }
};

exports.getAvailableUsers = async (_req, res) => {
    try {
        const [users] = await masterPool.query(`
            SELECT id, id AS rbac_user_id, name, username, email, phone, role
            FROM users
            WHERE is_active = 1 AND is_ticket_employee = 0
              AND user_type IN ('staff', 'admin')
            ORDER BY name
        `);
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Get Available Users Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching available users' });
    }
};

exports.getEmployeeHistory = async (req, res) => {
    try {
        const employeeId = Number(req.params.id);
        const [users] = await masterPool.query(
            'SELECT id, name FROM users WHERE id = ? AND is_ticket_employee = 1',
            [employeeId]
        );
        if (!users.length) return res.status(404).json({ success: false, message: 'Ticket user not found' });

        const [complaints] = await masterPool.query(`
            SELECT c.id, c.complaint_number AS ticket_number, c.title, c.status,
                   c.priority, c.created_at, c.category_id, cat.name AS category_name
            FROM complaints c
            LEFT JOIN categories cat ON cat.id = c.category_id
            WHERE EXISTS (
                SELECT 1 FROM JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                    assigned_to INT PATH '$.assigned_to',
                    assignment_active BOOLEAN PATH '$.is_active'
                )) a
                WHERE a.assigned_to = ? AND a.assignment_active = TRUE
            )
            ORDER BY c.created_at DESC
            LIMIT 100
        `, [employeeId]);
        const totals = complaints.reduce((stats, complaint) => {
            stats.total_assigned += 1;
            if (['completed', 'resolved'].includes(complaint.status)) stats.completed_tickets += 1;
            if (complaint.status === 'closed') stats.closed_tickets += 1;
            if (['approaching', 'resolving', 'in_progress'].includes(complaint.status)) stats.in_progress_tickets += 1;
            if (complaint.priority === 'critical' && !['completed', 'closed'].includes(complaint.status)) stats.critical_pending += 1;
            return stats;
        }, { total_assigned: 0, completed_tickets: 0, closed_tickets: 0, in_progress_tickets: 0, critical_pending: 0 });
        res.json({ success: true, data: { employee: users[0], stats: totals, history: complaints } });
    } catch (error) {
        console.error('Get Employee History Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching ticket user history' });
    }
};
