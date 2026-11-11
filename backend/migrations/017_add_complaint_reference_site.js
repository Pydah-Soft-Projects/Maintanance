const { masterPool } = require('../config/database');

async function up() {
    const [columns] = await masterPool.query("SHOW COLUMNS FROM complaints LIKE 'reference_site'");
    if (!columns.length) {
        await masterPool.query(`
            ALTER TABLE complaints
            ADD COLUMN reference_site ENUM('SDMS', 'HMS', 'HRMS') NULL AFTER requester_type
        `);
    }

    const [indexes] = await masterPool.query("SHOW INDEX FROM complaints WHERE Key_name = 'idx_complaints_reference_site'");
    if (!indexes.length) {
        await masterPool.query(`
            ALTER TABLE complaints
            ADD KEY idx_complaints_reference_site (reference_site, created_at)
        `);
    }
    await masterPool.query(`
        UPDATE complaints
        SET reference_site = CASE
            WHEN requester_type = 'student' THEN 'SDMS'
            WHEN requester_type = 'staff' THEN 'HRMS'
        END
        WHERE reference_site IS NULL
    `);
}

async function down() {
    await masterPool.query(`
        ALTER TABLE complaints
        DROP INDEX idx_complaints_reference_site,
        DROP COLUMN reference_site
    `);
}

module.exports = { up, down };
