USE maintenance_db;

-- One-time upgrade for databases that already have the approval workflow tables.
ALTER TABLE approval_workflow_stages
    MODIFY COLUMN group_id INT NULL,
    ADD COLUMN member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL AFTER stage_name;

ALTER TABLE complaint_approval_steps
    MODIFY COLUMN group_id INT NULL,
    ADD COLUMN member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL AFTER stage_name;
