const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const { authenticateHRMSUser } = require('../utils/hrmsAuth');
const { verifySsoToken, resolveUserFromSsoPayload } = require('../utils/hrmsSso');
const { mergePermissions } = require('../utils/permissions');

const SUPER_ADMIN_PERMISSIONS = {
    ticket_dashboard: { read: true },
    ticket_management: { read: true, write: true, update: true, delete: true },
    category_management: { read: true, write: true, update: true, delete: true },
    employee_management: { read: true, write: true, update: true, delete: true }
};

const parseJson = (value, fallback = {}) => {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Failed to parse stored permissions:', error.message);
        return fallback;
    }
};

const buildUserResponse = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    role: row.role,
    collegeId: row.college_id,
    permissions: ['admin', 'super_admin'].includes(row.role) ? SUPER_ADMIN_PERMISSIONS : parseJson(row.permissions),
    isActive: row.is_active,
    ...(row.hrms_id ? { hrmsId: row.hrms_id, is_hrms_user: true } : {})
});

const attachTicketAccess = async (payload) => {
    if (['admin', 'super_admin'].includes(payload.role)) {
        return { ...payload, ticketAccess: 'manage', permissions: SUPER_ADMIN_PERMISSIONS };
    }
    if (payload.role === 'student') return { ...payload, ticketAccess: 'request' };
    if (!payload.id) return { ...payload, ticketAccess: payload.ticketAccess || 'request' };

    const [rows] = await masterPool.query(`
        SELECT u.is_ticket_employee, u.role_id, u.assigned_categories,
               u.assigned_subcategories, u.permissions AS user_permissions,
               r.role_name AS custom_role_name, r.permissions AS role_permissions
        FROM users u LEFT JOIN roles r ON r.id = u.role_id AND r.is_active = 1
        WHERE u.id = ? AND u.user_type IN ('staff', 'admin') LIMIT 1
    `, [payload.id]);

    if (rows.length) {
        const row = rows[0];
        const ticketPermissions = mergePermissions(row.role_permissions, row.user_permissions);
        const hasTicketPermissions = Object.keys(ticketPermissions).length > 0;
        if (row.is_ticket_employee || hasTicketPermissions) {
            return {
                ...payload,
                ticketAccess: 'manage',
                ticketRole: row.custom_role_name || payload.role,
                role: row.custom_role_name || payload.role,
                permissions: ticketPermissions,
                assignedCategories: parseJson(row.assigned_categories, []),
                assignedSubcategories: parseJson(row.assigned_subcategories, [])
            };
        }
    }
    return { ...payload, ticketAccess: 'request' };
};

const buildTokenPayload = (user) => ({
    id: user.id || null,
    role: user.role,
    username: user.username,
    name: user.name,
    email: user.email,
    ticketAccess: user.ticketAccess,
    ...(user.hrmsId ? { hrmsId: user.hrmsId, is_hrms_user: true } : {}),
    ...(user.admission_number ? { admissionNumber: user.admission_number } : {})
});

const issueAuthResponse = async (res, payload) => {
    const user = await attachTicketAccess(payload);
    const token = jwt.sign(buildTokenPayload(user), process.env.JWT_SECRET || 'secret_key', { expiresIn: '24h' });
    return res.status(200).json({ success: true, message: 'Login successful', token, user });
};

exports.verifyToken = async (req, res) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: 'Invalid token' });
        if (!authUser.id) {
            return res.status(403).json({ success: false, message: 'Account is not registered on this site' });
        }

        const [rows] = await masterPool.query(
            "SELECT * FROM users WHERE id = ? LIMIT 1",
            [authUser.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        if (!rows[0].is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });
        return res.json({ success: true, user: await attachTicketAccess(buildUserResponse(rows[0])) });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ success: false, message: 'Unable to verify token' });
    }
};

exports.unifiedLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' });

        try {
            const hrmsResult = await authenticateHRMSUser(username, password, masterPool);
            if (hrmsResult?.rbacUser) {
                if (!hrmsResult.rbacUser.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });
                return issueAuthResponse(res, buildUserResponse(hrmsResult.rbacUser));
            }
        } catch (error) {
            if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
            console.error('HRMS authentication failed:', error);
        }

        const [rows] = await masterPool.query(
            `SELECT * FROM users
             WHERE (username = ? OR email = ?)
               AND is_active = 1 LIMIT 1`,
            [username, username]
        );
        const user = rows[0];
        if (!user || user.hrms_id || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        return issueAuthResponse(res, buildUserResponse(user));
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.hrmsSsoSession = async (req, res) => {
    try {
        const token = req.body.token || req.query.token;
        const payload = verifySsoToken(token);
        const resolved = await resolveUserFromSsoPayload(payload, masterPool);
        if (!resolved) {
            return res.status(403).json({
                success: false,
                message: 'Your account is not registered on this site. Please contact an administrator to grant access.'
            });
        }
        const user = resolved.type === 'rbac'
            ? buildUserResponse(resolved.user)
            : resolved.type === 'student'
                ? {
                    id: resolved.student.id,
                    name: resolved.student.name,
                    username: resolved.student.username,
                    phone: resolved.student.phone,
                    role: 'student',
                    admission_number: resolved.student.admission_number,
                    student_photo: resolved.student.student_photo,
                    course: resolved.student.course,
                    branch: resolved.student.branch,
                    college: resolved.student.college,
                    current_year: resolved.student.current_year,
                    current_semester: resolved.student.current_semester
                }
                : null;
        if (!user) {
            return res.status(403).json({
                success: false,
                message: 'Your account is not registered on this site. Please contact an administrator to grant access.'
            });
        }
        return issueAuthResponse(res, user);
    } catch (error) {
        console.error('HRMS SSO error:', error);
        res.status(error.statusCode || 401).json({ success: false, message: error.message || 'Invalid HRMS SSO token' });
    }
};

exports.getSsoConfig = (_req, res) => {
    res.json({
        success: true,
        hrmsPortalUrl: process.env.HRMS_PORTAL_URL || 'https://hrms.pydah.edu.in'
    });
};
