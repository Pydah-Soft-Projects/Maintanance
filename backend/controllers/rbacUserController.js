const { masterPool } = require('../config/database');
const employeeController = require('./employeeController');

const isAdmin = (user) => ['admin', 'super_admin'].includes(user?.role);

exports.getUsers = async (_req, res) => {
    try {
        const [rows] = await masterPool.query(`
            SELECT u.id, u.name, u.email, u.phone, u.username, u.role,
                   u.permissions, u.is_active, u.created_at, u.updated_at,
                   u.college_id, u.is_ticket_employee, u.hrms_id,
                   (SELECT COUNT(DISTINCT c.id)
                    FROM complaints c,
                    JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                        assigned_to INT PATH '$.assigned_to',
                        assignment_active BOOLEAN PATH '$.is_active'
                    )) a
                    WHERE a.assigned_to = u.id AND a.assignment_active = TRUE
                      AND c.status NOT IN ('closed', 'completed')) AS active_tickets_count
            FROM users u
            WHERE u.is_ticket_employee = 1 AND u.is_active = 1
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    return employeeController.createEmployee(req, res);
};

exports.updateUser = async (req, res) => {
    return employeeController.updateEmployee(req, res);
};

exports.getHrmsDirectory = async (req, res) => {
    return employeeController.getHrmsEmployees(req, res);
};

exports.linkHrmsUser = async (req, res) => {
    return employeeController.createEmployee(req, res);
};

exports.updateUserAccess = async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Admin access required' });
    try {
        const role = req.body.role;
        const permissions = req.body.permissions;
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        const [users] = await masterPool.query('SELECT id, role FROM users WHERE id = ? AND is_active = 1', [id]);
        if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
        if (['admin', 'super_admin'].includes(users[0].role)) {
            return res.status(403).json({ success: false, message: 'Administrator access cannot be changed here' });
        }
        await masterPool.query(
            'UPDATE users SET name = COALESCE(NULLIF(?, \'\'), name), role = COALESCE(?, role), permissions = ?, updated_at = NOW() WHERE id = ?',
            [name, role, permissions ? JSON.stringify(permissions) : null, id]
        );
        res.json({ success: true, message: 'User access updated' });
    } catch (error) {
        console.error('Update User Access Error:', error);
        res.status(500).json({ success: false, message: 'Server error updating user access' });
    }
};

exports.deleteUser = async (req, res) => {
    return employeeController.deleteEmployee(req, res);
};
