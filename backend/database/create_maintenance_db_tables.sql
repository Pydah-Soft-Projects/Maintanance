USE maintenance_db;

-- Four-table schema:
-- users: HRMS-linked staff and administrators managed by this application.
-- categories: complaint categories and subcategories.
-- roles: system and custom roles with permission definitions.
-- complaints: requester details plus assignments, comments, status history, and feedback.

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
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
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

INSERT IGNORE INTO roles
    (role_name, display_name, description, permissions, is_system_role, is_active)
VALUES
    (
        'super_admin',
        'Super Administrator',
        'Full system access with all permissions',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":true},"employee_management":{"read":true,"write":true,"update":true,"delete":true},"category_management":{"read":true,"write":true,"update":true,"delete":true}}',
        1,
        1
    ),
    (
        'admin',
        'Administrator',
        'Administrative access with most permissions',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":true},"employee_management":{"read":true,"write":true,"update":true,"delete":false},"category_management":{"read":true,"write":true,"update":true,"delete":false}}',
        1,
        1
    ),
    (
        'manager',
        'Ticket Manager',
        'Can manage tickets and assign workers',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":false},"employee_management":{"read":true,"write":true,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    ),
    (
        'staff',
        'Staff Member',
        'Staff with ticket management capabilities',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":false},"employee_management":{"read":true,"write":true,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    ),
    (
        'worker',
        'Ticket Worker',
        'Can view and update assigned complaints',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":false,"update":true,"delete":false},"employee_management":{"read":false,"write":false,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    );
