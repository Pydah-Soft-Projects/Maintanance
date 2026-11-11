USE maintenance_db;

-- Keep the role records used by approval setup available to user assignment
-- and the role-management screen.
INSERT INTO roles
    (role_name, display_name, description, permissions, is_system_role, is_active)
VALUES
    (
        'manager',
        'Manager',
        'Manager role used by approval workflows',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":false},"employee_management":{"read":true,"write":true,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    ),
    (
        'worker',
        'Worker',
        'Worker role used by approval workflows',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":false,"update":true,"delete":false},"employee_management":{"read":false,"write":false,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
        1,
        1
    )
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    is_system_role = VALUES(is_system_role),
    is_active = VALUES(is_active),
    updated_at = NOW();
