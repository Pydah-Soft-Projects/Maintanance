const { masterPool } = require('../config/database');

async function up() {
    for (const tableName of ['approval_workflow_stages', 'complaint_approval_steps']) {
        await masterPool.query(
            `ALTER TABLE ${tableName}
             MODIFY COLUMN member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL`
        );
    }
}

async function down() {
    throw new Error('Approval stages using Sub-admin or Superadmin cannot be safely rolled back.');
}

module.exports = { up, down };
