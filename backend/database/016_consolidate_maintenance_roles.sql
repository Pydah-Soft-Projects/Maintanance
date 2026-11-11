USE maintenance_db;

INSERT INTO roles
    (role_name, display_name, description, permissions, is_system_role, is_active)
VALUES
    (
        'worker',
        'Worker',
        'Can view and update assigned complaints',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":false,"update":true,"delete":false},"employee_management":{"read":false,"write":false,"update":false,"delete":false},"category_management":{"read":true,"write":false,"update":false,"delete":false}}',
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
        'super_admin',
        'Superadmin',
        'Full system access with all permissions',
        '{"ticket_dashboard":{"read":true},"ticket_management":{"read":true,"write":true,"update":true,"delete":true},"employee_management":{"read":true,"write":true,"update":true,"delete":true},"category_management":{"read":true,"write":true,"update":true,"delete":true}}',
        1,
        1
    )
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    permissions = VALUES(permissions),
    is_system_role = 1,
    is_active = 1,
    updated_at = NOW();

UPDATE approval_workflow_stages s
LEFT JOIN approval_service_groups g ON g.id = s.group_id
SET s.member_type = COALESCE(s.member_type, g.member_type),
    s.group_id = NULL
WHERE s.group_id IS NOT NULL;

UPDATE approval_service_groups
SET is_active = 0
WHERE member_type = 'manager';

UPDATE roles
SET is_active = 0, updated_at = NOW()
WHERE role_name NOT IN ('worker', 'manager', 'sub_admin', 'super_admin');

UPDATE users u
JOIN roles r
  ON r.role_name = CASE
      WHEN u.role = 'admin' THEN 'sub_admin'
      WHEN u.role IN ('manager', 'staff') THEN 'manager'
      WHEN u.role IN ('manager', 'worker', 'sub_admin', 'super_admin') THEN u.role
      ELSE 'worker'
  END
SET u.role = r.role_name,
    u.role_id = r.id,
    u.user_type = CASE WHEN r.role_name = 'super_admin' THEN 'admin' ELSE 'staff' END,
    u.permissions = NULL,
    u.updated_at = NOW()
WHERE u.is_ticket_employee = 1 OR u.user_type = 'admin';
