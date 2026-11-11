USE maintenance_db;

-- One-time upgrade for databases with role-based approval stage columns.
ALTER TABLE approval_workflow_stages
    MODIFY COLUMN member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL;

ALTER TABLE complaint_approval_steps
    MODIFY COLUMN member_type ENUM('manager', 'worker', 'sub_admin', 'super_admin') NULL;
