require('dotenv').config();
const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');

const username = process.argv[2] || process.env.SUPERADMIN_USERNAME?.trim() || 'superadmin';
const password = process.argv[3] || process.env.SUPERADMIN_PASSWORD || 'superadmin123';
const email = process.argv[4] || process.env.SUPERADMIN_EMAIL?.trim() || 'superadmin@pydah.edu.in';
const name = 'Super Admin';

const superAdminPermissions = {
    dashboard: { view: true },
    settings: { view: true, edit: true },
    reports: { view: true, download: true },
    user_management: { view: true, control: true },
    ticket_dashboard: { read: true, write: true, update: true, delete: true },
    ticket_management: { read: true, write: true, update: true, delete: true },
    employee_management: { read: true, write: true, update: true, delete: true },
    category_management: { read: true, write: true, update: true, delete: true }
};

const adminPermissions = {
    ticket_dashboard: { read: true },
    ticket_management: { read: true, write: true, update: true, delete: true },
    employee_management: { read: true, write: true, update: true, delete: false },
    category_management: { read: true, write: true, update: true, delete: false }
};

const managerPermissions = {
    ticket_dashboard: { read: true },
    ticket_management: { read: true, write: true, update: true, delete: false },
    employee_management: { read: true, write: true, update: false, delete: false },
    category_management: { read: true, write: false, update: false, delete: false }
};

const workerPermissions = {
    ticket_dashboard: { read: true },
    ticket_management: { read: true, write: false, update: true, delete: false },
    employee_management: { read: false, write: false, update: false, delete: false },
    category_management: { read: true, write: false, update: false, delete: false }
};

const defaultRoles = [
    {
        role_name: 'super_admin',
        display_name: 'Super Administrator',
        description: 'Full system access with all permissions',
        permissions: JSON.stringify(superAdminPermissions),
        is_system_role: 1
    },
    {
        role_name: 'admin',
        display_name: 'Administrator',
        description: 'Administrative access with most permissions',
        permissions: JSON.stringify(adminPermissions),
        is_system_role: 1
    },
    {
        role_name: 'manager',
        display_name: 'Ticket Manager',
        description: 'Can manage tickets and assign workers',
        permissions: JSON.stringify(managerPermissions),
        is_system_role: 1
    },
    {
        role_name: 'worker',
        display_name: 'Ticket Worker',
        description: 'Can view and resolve assigned tickets',
        permissions: JSON.stringify(workerPermissions),
        is_system_role: 1
    }
];

const seedSuperadmin = async () => {
    console.log(`Starting seed with username: "${username}"...`);

    // 1. Ensure default system roles exist
    for (const r of defaultRoles) {
        const [existing] = await masterPool.query('SELECT id FROM roles WHERE role_name = ?', [r.role_name]);
        if (existing.length === 0) {
            await masterPool.query(
                'INSERT INTO roles (role_name, display_name, description, permissions, is_system_role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
                [r.role_name, r.display_name, r.description, r.permissions, r.is_system_role]
            );
            console.log(`Created default role: ${r.role_name}`);
        }
    }

    const [roles] = await masterPool.query('SELECT id FROM roles WHERE role_name = ? LIMIT 1', ['super_admin']);
    if (!roles.length) {
        throw new Error('Failed to find or create super_admin role');
    }
    const superAdminRoleId = roles[0].id;

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Upsert user in users table
    const [existingUsers] = await masterPool.query(
        'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username, email]
    );

    if (existingUsers.length > 0) {
        const existingId = existingUsers[0].id;
        await masterPool.query(
            `UPDATE users
             SET name = ?, username = ?, email = ?, password_hash = ?, role = 'super_admin',
                 role_id = ?, user_type = 'admin', permissions = ?, is_active = 1, updated_at = NOW()
             WHERE id = ?`,
            [name, username, email, passwordHash, superAdminRoleId, JSON.stringify(superAdminPermissions), existingId]
        );
        console.log(`Updated existing user ID ${existingId} to superadmin ("${username}").`);
    } else {
        const [insertResult] = await masterPool.query(
            `INSERT INTO users
             (user_type, name, username, email, password_hash, role, role_id, permissions, is_active, created_at, updated_at)
             VALUES ('admin', ?, ?, ?, ?, 'super_admin', ?, ?, 1, NOW(), NOW())`,
            [name, username, email, passwordHash, superAdminRoleId, JSON.stringify(superAdminPermissions)]
        );
        console.log(`Created new superadmin user ID ${insertResult.insertId} ("${username}").`);
    }

    // 4. Verify password hash
    const [verifyRows] = await masterPool.query(
        'SELECT id, user_type, name, username, email, role, role_id, password_hash, is_active FROM users WHERE username = ?',
        [username]
    );
    const user = verifyRows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log(`Verification: username="${user.username}", role="${user.role}", active=${user.is_active}, passwordMatch=${isMatch}`);

    if (!isMatch) {
        throw new Error('Password verification failed immediately after seeding!');
    }
    console.log('Superadmin successfully seeded and verified!');
};

seedSuperadmin()
    .catch((error) => {
        console.error('Failed to seed superadmin:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await masterPool.end();
    });
