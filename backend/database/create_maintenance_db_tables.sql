USE maintenance_db;

-- Core application schema:
-- users: HRMS-linked staff and administrators managed by this application.
-- categories: complaint categories and subcategories.
-- roles: system and custom roles with permission definitions.
-- complaints: requester details plus assignments, comments, status history, and feedback.
-- Approval workflow tables: configurable service groups, flows, and complaint snapshots.

CREATE TABLE IF NOT EXISTS roles (
    id INT NOT NULL AUTO_INCREMENT,
    role_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    permissions JSON NOT NULL,
    is_system_role TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_role_name (role_name),
    KEY idx_roles_active (is_active),
    KEY idx_roles_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    user_type ENUM('staff', 'admin') NOT NULL DEFAULT 'staff',
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'worker',
    role_id INT NULL,
    permissions JSON NULL,
    assigned_modules JSON NULL,
    assigned_categories JSON NULL,
    assigned_subcategories JSON NULL,
    college_id INT NULL,
    hrms_id VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    is_ticket_employee TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    push_subscriptions JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_hrms_id (hrms_id),
    KEY idx_users_type_role_active (user_type, role, is_active),
    KEY idx_users_role_id (role_id),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    CONSTRAINT fk_users_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    parent_id INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    display_order INT NOT NULL DEFAULT 0,
    requires_approval TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_categories_parent (parent_id),
    KEY idx_categories_active_order (is_active, display_order),
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaints (
    id INT NOT NULL AUTO_INCREMENT,
    complaint_number VARCHAR(100) NOT NULL,
    requester_user_id INT NULL,
    requester_type ENUM('student', 'staff') NOT NULL DEFAULT 'student',
    reference_site ENUM('SDMS', 'HMS', 'HRMS') NULL,
    requester_hrms_id VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    requester_name VARCHAR(255) NULL,
    requester_identifier VARCHAR(100) NULL,
    requester_phone VARCHAR(30) NULL,
    category_id INT NOT NULL,
    sub_category_id INT NULL,
    college_id INT NULL,
    college_name VARCHAR(255) NULL,
    block_no VARCHAR(100) NULL,
    floor_no VARCHAR(100) NULL,
    room_no VARCHAR(100) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    photo_url VARCHAR(1024) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    assignments JSON NOT NULL,
    comments JSON NOT NULL,
    status_history JSON NOT NULL,
    feedback JSON NULL,
    resolved_at DATETIME NULL,
    closed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_complaints_number (complaint_number),
    KEY idx_complaints_requester (requester_user_id),
    KEY idx_complaints_requester_hrms (requester_hrms_id),
    KEY idx_complaints_reference_site (reference_site, created_at),
    KEY idx_complaints_category (category_id),
    KEY idx_complaints_sub_category (sub_category_id),
    KEY idx_complaints_status_created (status, created_at),
    CONSTRAINT fk_complaints_requester
        FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_complaints_category
        FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT fk_complaints_sub_category
        FOREIGN KEY (sub_category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_service_groups (
    id INT NOT NULL AUTO_INCREMENT,
    member_type ENUM('manager', 'worker') NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_approval_service_group (member_type, service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_workflow_stages (
    id INT NOT NULL AUTO_INCREMENT,
    workflow_id INT NOT NULL,
    stage_order INT NOT NULL,
    stage_name VARCHAR(150) NOT NULL,
    group_id INT NULL,
    member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_approval_workflow_stage (workflow_id, stage_order),
    KEY idx_approval_workflow_stages_group (group_id),
    CONSTRAINT fk_approval_workflow_stages_workflow
        FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_workflow_stages_group
        FOREIGN KEY (group_id) REFERENCES approval_service_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_approval_steps (
    id INT NOT NULL AUTO_INCREMENT,
    instance_id INT NOT NULL,
    stage_order INT NOT NULL,
    stage_name VARCHAR(150) NOT NULL,
    group_id INT NULL,
    member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_approval_step_members (
    step_id INT NOT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (step_id, user_id),
    KEY idx_complaint_approval_step_members_user (user_id),
    CONSTRAINT fk_approval_step_members_step
        FOREIGN KEY (step_id) REFERENCES complaint_approval_steps(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_step_members_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO approval_service_groups (member_type, service_type)
VALUES
    ('worker', 'Canteen'),
    ('worker', 'Internet'),
    ('worker', 'Housekeeping'),
    ('worker', 'Plumbing'),
    ('worker', 'Electricity'),
    ('worker', 'Others');

INSERT IGNORE INTO roles
    (role_name, display_name, description, permissions, is_system_role, is_active)
VALUES
    (
        'super_admin',
        'Superadmin',
        'Full system access with all permissions',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":true},"employee_management":{"read":true,"write":true,"update":true,"delete":true},"category_management":{"read":true,"write":true,"update":true,"delete":true}}',
        1,
        1
    ),
    (
        'manager',
        'Manager',
        'Can view all complaints and assign workers',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":false},"employee_management":{"read":true,"write":false,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    ),
    (
        'sub_admin',
        'Sub-admin',
        'Can view all complaints, update statuses, and manage maintenance users',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":false},"employee_management":{"read":true,"write":true,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    ),
    (
        'worker',
        'Worker',
        'Can view and update assigned complaints',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":false,"update":true,"delete":false},"employee_management":{"read":false,"write":false,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    );
