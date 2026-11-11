# Database Migrations

This directory contains database migration scripts for the Ticket Backend.

## Overview

Migrations are used to manage database schema changes in a version-controlled manner. Each migration file represents a specific change to the database structure.

## Migration Files

- **`001_create_employees_table.js`** - Creates the `ticket_employees` table for managing ticket-specific employee assignments
- **`013_approval_workflows.js`** - Creates configurable approval-flow tables and seeds manager/worker service groups
- **`014_role_based_approval_stages.js`** - Supports role-based approval stages across all service types for that role
- **`015_consolidate_maintenance_roles.js`** - Consolidates maintenance employees into Worker, Manager, Sub-admin, and Superadmin
- **`016_expand_approval_approver_roles.js`** - Adds Sub-admin and Superadmin as approval stage roles
- **`017_add_complaint_reference_site.js`** - Stores the SDMS, HMS, or HRMS source for each complaint

Migration 017 backfills existing student complaints to SDMS and staff complaints to HRMS because older records do not retain source provenance. New student complaints default to SDMS and can be marked HMS for hostel requests; staff complaints default to HRMS. External integrations should send `reference_site` when creating a complaint.

## Approval Workflow Schema

The canonical SQL setup script, `backend/database/create_maintenance_db_tables.sql`, creates the approval workflow tables and seeds the sample Manager/Worker service groups. Run this script against `maintenance_db` when creating a database or when adding the approval schema to an existing database. It uses `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`, so it can be re-run without replacing existing workflow data.

For an existing database with approval tables, run `backend/database/014_role_based_approval_stages.sql` once to add role-based stage support, or run the migration runner. Approval stages can select Manager, Worker, Sub-admin, or Superadmin; approvers are snapshotted from active HRMS-linked users for the selected role. Workers must be assigned to an active Worker service type. Existing complaint approval snapshots are not changed.

After the role consolidation, to allow Sub-admin and Superadmin stages on an existing database with role-based stages, run `backend/database/017_expand_approval_approver_roles.sql` once, or run `npm run migrate` to apply migration 016. Flows can be configured before approvers exist; assign eligible users before complaints need approval.

Existing complaints are not backfilled. The app expects the approval schema to exist before using Approval setup.

Manager and Worker approver roles also use the shared `roles` table used by User Management and Role Management. For an existing database, run `backend/database/015_sync_approval_roles.sql` to ensure both roles are active and visible in those screens. The user-role selector and role list load from `/api/roles`.

For an existing database that already has the approval workflow tables and role-based stage columns, run `backend/database/016_consolidate_maintenance_roles.sql` once, or use `npm run migrate` to apply migration 015. This maps legacy admin accounts to Sub-admin, maps legacy `staff` and Manager accounts to Manager, preserves Worker and Superadmin accounts, and maps other maintenance employee roles to Worker. It deactivates non-standard role records, moves configured approval stages to role-wide approvers, and retires Manager service groups; only Workers have service types. HRMS requester accounts and existing complaint approval snapshots are not changed. The migration clears per-user permission overrides so permissions come from the four standard roles. Run this consolidation before creating custom roles; afterward, Superadmins can create custom roles from Role Management.

## Running Migrations

Migrations are not run automatically when the server starts. The migration runner remains available for deployments that use versioned migrations:

```bash
npm run migrate
npm run migrate:rollback
```

The approval schema is also represented by `013_approval_workflows.js` for use with this runner. Use either the SQL setup script or the migration runner to install it; do not roll back a migration on a database with live workflow data.

## Migration Structure

Each migration file must export two functions:

```javascript
// Apply the migration
async function up() {
    // Create tables, add columns, etc.
}

// Revert the migration
async function down() {
    // Drop tables, remove columns, etc.
}

module.exports = { up, down };
```

## Creating New Migrations

1. Create a new file in this directory with a numbered prefix:
   ```
   002_your_migration_name.js
   ```

2. Implement the `up()` and `down()` functions:
   ```javascript
   const { masterPool } = require('../config/database');

   async function up() {
       await masterPool.query(`
           -- Your SQL here
       `);
   }

   async function down() {
       await masterPool.query(`
           -- Rollback SQL here
       `);
   }

   module.exports = { up, down };
   ```

3. The migration will run automatically on next server start, or run manually:
   ```bash
   npm run migrate
   ```

## Migration Tracking

The system creates a `migrations` table to track which migrations have been executed:

```sql
CREATE TABLE migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Best Practices

1. **Never modify executed migrations** - Create a new migration instead
2. **Always provide a `down()` function** - For rollback capability
3. **Test migrations** - Run them in development before production
4. **Use transactions** - When possible, wrap migrations in transactions
5. **Keep migrations small** - One logical change per migration

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message in the console
2. Fix the issue in the migration file
3. Rollback if needed: `npm run migrate:rollback`
4. Run the migration again: `npm run migrate`

### Reset All Migrations
⚠️ **Warning: This will delete all data**

```sql
DROP TABLE IF EXISTS ticket_employees;
DROP TABLE IF EXISTS migrations;
```

Then recreate the database schema from the SQL setup scripts.

## Current Schema

### ticket_employees
Stores ticket-specific employee assignments linking RBAC users to ticket roles.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| rbac_user_id | INT | Foreign key to rbac_users table |
| role | ENUM('staff', 'worker') | Employee role (Manager/Worker) |
| is_active | TINYINT(1) | Soft delete flag |
| assigned_date | DATETIME | When employee was assigned |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Record update timestamp |

**Indexes:**
- `idx_employee_role` - On `role` column
- `idx_employee_active` - On `is_active` column

**Constraints:**
- Foreign key to `rbac_users(id)` with CASCADE delete
- Unique constraint on `(rbac_user_id, is_active)` to prevent duplicate active assignments
