const { masterPool } = require('../config/database');

async function up() {
    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS approval_service_groups (
            id INT NOT NULL AUTO_INCREMENT,
            member_type ENUM('manager', 'worker') NOT NULL,
            service_type VARCHAR(100) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_approval_service_group (member_type, service_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS approval_service_group_members (
            group_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id),
            KEY idx_approval_group_members_user (user_id),
            CONSTRAINT fk_approval_group_members_group
                FOREIGN KEY (group_id) REFERENCES approval_service_groups(id) ON DELETE CASCADE,
            CONSTRAINT fk_approval_group_members_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        INSERT IGNORE INTO approval_service_groups (member_type, service_type)
        VALUES
            ('manager', 'Canteen'),
            ('manager', 'Internet'),
            ('manager', 'Housekeeping'),
            ('manager', 'Plumbing'),
            ('manager', 'Electricity'),
            ('manager', 'Others'),
            ('worker', 'Canteen'),
            ('worker', 'Internet'),
            ('worker', 'Housekeeping'),
            ('worker', 'Plumbing'),
            ('worker', 'Electricity'),
            ('worker', 'Others')
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS approval_workflows (
            id INT NOT NULL AUTO_INCREMENT,
            scope_key VARCHAR(64) NOT NULL,
            scope_type ENUM('default', 'category') NOT NULL,
            category_id INT NULL,
            name VARCHAR(150) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_approval_workflow_scope (scope_key),
            KEY idx_approval_workflows_category (category_id),
            CONSTRAINT fk_approval_workflows_category
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS approval_workflow_stages (
            id INT NOT NULL AUTO_INCREMENT,
            workflow_id INT NOT NULL,
            stage_order INT NOT NULL,
            stage_name VARCHAR(150) NOT NULL,
            group_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_approval_workflow_stage (workflow_id, stage_order),
            KEY idx_approval_workflow_stages_group (group_id),
            CONSTRAINT fk_approval_workflow_stages_workflow
                FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE,
            CONSTRAINT fk_approval_workflow_stages_group
                FOREIGN KEY (group_id) REFERENCES approval_service_groups(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS complaint_approval_instances (
            id INT NOT NULL AUTO_INCREMENT,
            complaint_id INT NOT NULL,
            workflow_id INT NOT NULL,
            current_stage_order INT NOT NULL DEFAULT 1,
            state ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_complaint_approval_instance (complaint_id),
            KEY idx_approval_instances_state (state, current_stage_order),
            CONSTRAINT fk_approval_instances_complaint
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
            CONSTRAINT fk_approval_instances_workflow
                FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS complaint_approval_steps (
            id INT NOT NULL AUTO_INCREMENT,
            instance_id INT NOT NULL,
            stage_order INT NOT NULL,
            stage_name VARCHAR(150) NOT NULL,
            group_id INT NOT NULL,
            state ENUM('pending', 'approved', 'rejected', 'skipped') NOT NULL DEFAULT 'pending',
            decision_by INT NULL,
            decision_notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            decided_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_complaint_approval_step (instance_id, stage_order),
            KEY idx_complaint_approval_steps_group (group_id),
            CONSTRAINT fk_complaint_approval_steps_instance
                FOREIGN KEY (instance_id) REFERENCES complaint_approval_instances(id) ON DELETE CASCADE,
            CONSTRAINT fk_complaint_approval_steps_group
                FOREIGN KEY (group_id) REFERENCES approval_service_groups(id) ON DELETE RESTRICT,
            CONSTRAINT fk_complaint_approval_steps_user
                FOREIGN KEY (decision_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await masterPool.query(`
        CREATE TABLE IF NOT EXISTS complaint_approval_step_members (
            step_id INT NOT NULL,
            user_id INT NOT NULL,
            PRIMARY KEY (step_id, user_id),
            KEY idx_complaint_approval_step_members_user (user_id),
            CONSTRAINT fk_approval_step_members_step
                FOREIGN KEY (step_id) REFERENCES complaint_approval_steps(id) ON DELETE CASCADE,
            CONSTRAINT fk_approval_step_members_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
}

async function down() {
    await masterPool.query('DROP TABLE IF EXISTS complaint_approval_step_members');
    await masterPool.query('DROP TABLE IF EXISTS complaint_approval_steps');
    await masterPool.query('DROP TABLE IF EXISTS complaint_approval_instances');
    await masterPool.query('DROP TABLE IF EXISTS approval_workflow_stages');
    await masterPool.query('DROP TABLE IF EXISTS approval_workflows');
    await masterPool.query('DROP TABLE IF EXISTS approval_service_group_members');
    await masterPool.query('DROP TABLE IF EXISTS approval_service_groups');
}

module.exports = { up, down };
