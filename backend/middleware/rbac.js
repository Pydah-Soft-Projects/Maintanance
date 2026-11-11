const { USER_ROLES, canCreateRole, hasPermission, validateRoleRequirements } = require('../constants/rbac');
const { masterPool } = require('../config/database');
const { mergePermissions } = require('../utils/permissions');

/**
 * Check if user is a super admin.
 */
const isSuperAdmin = (user) => {
    return user && user.role === USER_ROLES.SUPER_ADMIN;
};

/**
 * Parse JSON array data from database
 */
const parseArrayData = (data) => {
    if (!data) return [];
    try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return data ? [data] : [];
    }
};

/**
 * Verify user has required role
 * Usage: verifyRole('super_admin', 'campus_principal')
 */
const verifyRole = (...allowedRoles) => {
    return (req, res, next) => {
        const user = req.user || req.admin;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Super admin bypasses all role checks
        if (isSuperAdmin(user)) {
            return next();
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
            });
        }

        next();
    };
};

/**
 * Verify user has permission for a module
 * Usage: verifyPermission('student_management', 'write')
 */
const verifyPermission = (module, operation = 'read') => {
    return async (req, res, next) => {
        const user = req.user || req.admin;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Super admin has all permissions
        if (isSuperAdmin(user)) {
            return next();
        }

        let userPerms = {};
        if (user.id) {
            try {
                const [rows] = await masterPool.query(`
                    SELECT u.permissions AS user_permissions, r.permissions AS role_permissions
                    FROM users u
                    LEFT JOIN roles r ON u.role_id = r.id AND r.is_active = 1
                    WHERE u.id = ? AND u.is_active = 1
                `, [user.id]);
                if (rows.length > 0) {
                    userPerms = mergePermissions(rows[0].role_permissions, rows[0].user_permissions);
                }
            } catch (error) {
                console.error('Error fetching user permissions in rbac middleware:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Unable to verify user permissions'
                });
            }
        }

        // Check if user has the required permission
        if (!hasPermission(userPerms, module, operation)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permission: ${module} (${operation})`
            });
        }

        next();
    };
};

// ... (Other functions like allowStudentOwnProfileOrPermission, attachUserScope, verifyCanManageUser could be added if needed)
// For Ticket App, we mainly need Role and Permission checks.

module.exports = {
    isSuperAdmin,
    verifyRole,
    verifyPermission,
    parseArrayData
};
