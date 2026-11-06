const jwt = require('jsonwebtoken');
const { findLocalRbacUser, buildHrmsSessionProfile } = require('./hrmsAuth');

function verifySsoToken(ssoToken) {
    const secrets = [
        process.env.JWT_SECRET,
        process.env.HRMS_SSO_SECRET,
        process.env.JWT_SECRET || 'secret_key'
    ].filter(Boolean);

    const uniqueSecrets = [...new Set(secrets)];
    let lastError = null;

    for (const secret of uniqueSecrets) {
        try {
            return jwt.verify(ssoToken, secret);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Invalid SSO token');
}

/**
 * Build a ticket-app user from an HRMS / portal SSO JWT payload (no password).
 */
async function resolveUserFromSsoPayload(payload, masterPool) {
    const admissionNumber = payload.admissionNumber || payload.admission_number || null;
    if (payload.role === 'student' || admissionNumber) {
        return {
            type: 'student',
            student: {
                id: null,
                name: payload.name || payload.student_name || 'Student',
                username: payload.username || admissionNumber,
                admission_number: admissionNumber,
                phone: payload.phone || payload.phone_number || null,
                student_photo: payload.student_photo || null,
                course: payload.course || null,
                branch: payload.branch || null,
                college: payload.college || null,
                current_year: payload.current_year || null,
                current_semester: payload.current_semester || null
            }
        };
    }

    const hrmsId = payload.hrmsId || payload.hrms_id || null;
    const rbacId = payload.id || payload.userId || payload.rbacUserId || null;
    const username = payload.username || payload.emp_no || null;
    const email = payload.email || null;

    if (rbacId) {
        const [rows] = await masterPool.query(
            `SELECT id, name, username, email, phone, role, permissions, college_id,
                    is_active, hrms_id, user_type
             FROM users WHERE id = ? AND user_type IN ('staff', 'admin') LIMIT 1`,
            [rbacId]
        );
        if (rows.length > 0) {
            return { type: 'rbac', user: rows[0] };
        }
    }

    if (hrmsId) {
        const existing = await findLocalRbacUser(masterPool, { hrmsIdStr: hrmsId, email, username, empNo: username });
        if (existing) {
            return { type: 'rbac', user: existing };
        }
    }

    if (email || username) {
        const existing = await findLocalRbacUser(masterPool, { hrmsIdStr: hrmsId, email, username, empNo: username });
        if (existing) {
            return { type: 'rbac', user: existing };
        }
    }

    // Do not allow login for HRMS users not yet registered on this site
    return null;
}

module.exports = { verifySsoToken, resolveUserFromSsoPayload };
