const { masterPool } = require('../config/database');

const columnExists = async (tableName, columnName) => {
    const [columns] = await masterPool.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Number(columns[0].count) > 0;
};

async function up() {
    for (const tableName of ['approval_workflow_stages', 'complaint_approval_steps']) {
        await masterPool.query(`ALTER TABLE ${tableName} MODIFY COLUMN group_id INT NULL`);
        if (!(await columnExists(tableName, 'member_type'))) {
            await masterPool.query(
                `ALTER TABLE ${tableName}
                 ADD COLUMN member_type ENUM('manager', 'worker') NULL AFTER stage_name`
            );
        }
    }
}

async function down() {
    await masterPool.query(`
        UPDATE approval_workflow_stages s
        SET group_id = (
            SELECT MIN(g.id)
            FROM approval_service_groups g
            WHERE g.member_type = s.member_type
        )
        WHERE s.group_id IS NULL
    `);
    await masterPool.query(`
        UPDATE complaint_approval_steps s
        SET group_id = (
            SELECT MIN(g.id)
            FROM approval_service_groups g
            WHERE g.member_type = s.member_type
        )
        WHERE s.group_id IS NULL
    `);
    await masterPool.query('ALTER TABLE approval_workflow_stages MODIFY COLUMN group_id INT NOT NULL');
    await masterPool.query('ALTER TABLE complaint_approval_steps MODIFY COLUMN group_id INT NOT NULL');
    await masterPool.query('ALTER TABLE approval_workflow_stages DROP COLUMN member_type');
    await masterPool.query('ALTER TABLE complaint_approval_steps DROP COLUMN member_type');
}

module.exports = { up, down };
