const { masterPool } = require('../config/database');
const { getEligibleApproverCounts } = require('../utils/approvalApprovers');

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getActiveMembers = async (connection, userIds) => {
    const ids = [...new Set(userIds.map(Number))];
    if (!ids.length) return [];
    const [users] = await connection.query(
        `SELECT id
         FROM users
         WHERE id IN (?) AND is_active = 1 AND is_ticket_employee = 1
           AND role = 'worker'`,
        [ids]
    );
    return users.map((user) => Number(user.id));
};

exports.getConfiguration = async (_req, res) => {
    try {
        const approverCounts = await getEligibleApproverCounts(masterPool, [
            'manager',
            'worker',
            'sub_admin',
            'super_admin'
        ]);
        const [groups, members, workflows, stages, categories] = await Promise.all([
            masterPool.query(`
                SELECT id, member_type, service_type, is_active, created_at
                FROM approval_service_groups
                WHERE is_active = 1 AND member_type = 'worker'
                ORDER BY member_type, service_type
            `),
            masterPool.query(`
                SELECT gm.group_id, u.id AS user_id, u.name, u.username, u.email, u.phone
                FROM approval_service_group_members gm
                JOIN users u ON u.id = gm.user_id
                JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
                WHERE g.member_type = 'worker' AND u.is_active = 1
                  AND u.is_ticket_employee = 1 AND u.role = 'worker'
                ORDER BY u.name
            `),
            masterPool.query(`
                SELECT w.id, w.scope_type, w.category_id, w.name, w.updated_at, c.name AS category_name
                FROM approval_workflows w
                LEFT JOIN categories c ON c.id = w.category_id
                WHERE w.is_active = 1
                ORDER BY w.scope_type, c.name
            `),
            masterPool.query(`
                SELECT s.id, s.workflow_id, s.stage_order, s.stage_name, s.group_id,
                       COALESCE(s.member_type, g.member_type) AS member_type, g.service_type
                FROM approval_workflow_stages s
                LEFT JOIN approval_service_groups g ON g.id = s.group_id
                ORDER BY s.workflow_id, s.stage_order
            `),
            masterPool.query(`
                SELECT id, name
                FROM categories
                WHERE parent_id IS NULL AND is_active = 1
                ORDER BY name
            `)
        ]);
        const membersByGroup = new Map();
        members[0].forEach((member) => {
            const groupMembers = membersByGroup.get(member.group_id) || [];
            groupMembers.push({
                id: Number(member.user_id),
                name: member.name,
                username: member.username,
                email: member.email,
                phone: member.phone
            });
            membersByGroup.set(member.group_id, groupMembers);
        });
        const groupsWithMembers = groups[0].map((group) => ({
            ...group,
            members: membersByGroup.get(group.id) || []
        }));
        const stagesByWorkflow = new Map();
        stages[0].forEach((stage) => {
            const workflowStages = stagesByWorkflow.get(stage.workflow_id) || [];
            workflowStages.push({
                id: stage.id,
                stage_order: stage.stage_order,
                stage_name: stage.stage_name,
                member_type: stage.member_type,
                service_type: stage.service_type
            });
            stagesByWorkflow.set(stage.workflow_id, workflowStages);
        });
        res.json({
            success: true,
            data: {
                groups: groupsWithMembers,
                approver_counts: approverCounts,
                workflows: workflows[0].map((workflow) => ({
                    ...workflow,
                    stages: stagesByWorkflow.get(workflow.id) || []
                })),
                categories: categories[0]
            }
        });
    } catch (error) {
        console.error('Get approval workflow configuration error:', error);
        res.status(500).json({ success: false, message: 'Unable to load approval workflow configuration' });
    }
};

exports.createGroup = async (req, res) => {
    const memberType = req.body.member_type;
    const serviceType = String(req.body.service_type || '').trim();
    const memberIds = Array.isArray(req.body.member_ids) ? req.body.member_ids : [];
    if (memberType !== 'worker' || !serviceType || serviceType.length > 100) {
        return res.status(400).json({ success: false, message: 'A valid worker service type is required' });
    }
    if (memberIds.some((id) => !isPositiveInteger(id))) {
        return res.status(400).json({ success: false, message: 'Member IDs must be positive integers' });
    }

    let connection;
    try {
        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const validMembers = await getActiveMembers(connection, memberIds);
        if (validMembers.length !== new Set(memberIds.map(Number)).size) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Only active Workers already registered in the app can be added' });
        }
        const [existingGroups] = await connection.query(
            'SELECT id, is_active FROM approval_service_groups WHERE member_type = ? AND service_type = ? FOR UPDATE',
            [memberType, serviceType]
        );
        if (existingGroups.length && existingGroups[0].is_active) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'A group with this service type already exists for that role' });
        }
        let groupId;
        if (existingGroups.length) {
            groupId = Number(existingGroups[0].id);
            await connection.query(
                'UPDATE approval_service_groups SET is_active = 1 WHERE id = ?',
                [groupId]
            );
            await connection.query('DELETE FROM approval_service_group_members WHERE group_id = ?', [groupId]);
        } else {
            const [result] = await connection.query(
                'INSERT INTO approval_service_groups (member_type, service_type) VALUES (?, ?)',
                [memberType, serviceType]
            );
            groupId = result.insertId;
        }
        if (validMembers.length) {
            await connection.query(
                'INSERT INTO approval_service_group_members (group_id, user_id) VALUES ?',
                [validMembers.map((userId) => [groupId, userId])]
            );
        }
        await connection.commit();
        res.status(201).json({ success: true, message: 'Service group created', data: { id: groupId } });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'A group with this service type already exists for that role' });
        }
        console.error('Create approval service group error:', error);
        res.status(500).json({ success: false, message: 'Unable to create service group' });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateGroup = async (req, res) => {
    const groupId = Number(req.params.groupId);
    const memberType = req.body.member_type;
    const serviceType = String(req.body.service_type || '').trim();
    const memberIds = Array.isArray(req.body.member_ids) ? req.body.member_ids : [];
    if (!isPositiveInteger(groupId) || memberType !== 'worker' ||
        !serviceType || serviceType.length > 100 || memberIds.some((id) => !isPositiveInteger(id))) {
        return res.status(400).json({ success: false, message: 'Valid group, role, service name, and member IDs are required' });
    }

    let connection;
    try {
        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const [groups] = await connection.query(
            'SELECT id, member_type FROM approval_service_groups WHERE id = ? AND is_active = 1 FOR UPDATE',
            [groupId]
        );
        if (!groups.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Service group not found' });
        }
        if (groups[0].member_type !== 'worker') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Service types can only be assigned to Workers' });
        }
        const validMembers = await getActiveMembers(connection, memberIds);
        if (validMembers.length !== new Set(memberIds.map(Number)).size) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Only active Workers already registered in the app can be added' });
        }
        const [currentMembers] = await connection.query(
            'SELECT user_id FROM approval_service_group_members WHERE group_id = ?',
            [groupId]
        );
        const removedMemberIds = currentMembers
            .map((member) => Number(member.user_id))
            .filter((userId) => !validMembers.includes(userId));
        if (removedMemberIds.length) {
            const [pendingMemberApprovals] = await connection.query(
                `SELECT COUNT(*) AS count
                 FROM complaint_approval_step_members sm
                 JOIN complaint_approval_steps s ON s.id = sm.step_id AND s.state = 'pending'
                 JOIN complaint_approval_instances i ON i.id = s.instance_id AND i.state = 'pending'
                 WHERE (s.group_id = ? OR s.member_type = ?) AND sm.user_id IN (?)`,
                [groupId, groups[0].member_type, removedMemberIds]
            );
            if (Number(pendingMemberApprovals[0].count) > 0) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'Members assigned to pending approvals cannot be removed yet' });
            }
        }
        const [legacyWorkflowStages] = await connection.query(
            `SELECT COUNT(*) AS count
             FROM approval_workflow_stages s
             JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
             WHERE s.group_id = ? AND s.member_type IS NULL`,
            [groupId]
        );
        if (!validMembers.length && Number(legacyWorkflowStages[0].count) > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'A group used by an active approval flow must have at least one member' });
        }
        const affectedTypes = [...new Set([groups[0].member_type, memberType])];
        const [roleWorkflowStages] = await connection.query(
            `SELECT DISTINCT s.member_type
             FROM approval_workflow_stages s
             JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
             WHERE s.member_type IN (?)`,
            [affectedTypes]
        );
        if (roleWorkflowStages.length) {
            const [otherMembers] = await connection.query(
                `SELECT DISTINCT g.member_type, u.id
                 FROM approval_service_group_members gm
                 JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
                 JOIN users u ON u.id = gm.user_id AND u.is_active = 1
                   AND u.is_ticket_employee = 1
                 WHERE g.id <> ? AND g.member_type IN (?)`,
                [groupId, affectedTypes]
            );
            const availableTypes = new Set(otherMembers.map((member) => member.member_type));
            if (validMembers.length) availableTypes.add(memberType);
            if (roleWorkflowStages.some((stage) => !availableTypes.has(stage.member_type))) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'An active approval role must retain at least one eligible member' });
            }
        }
        await connection.query(
            'UPDATE approval_service_groups SET member_type = ?, service_type = ? WHERE id = ?',
            [memberType, serviceType, groupId]
        );
        await connection.query('DELETE FROM approval_service_group_members WHERE group_id = ?', [groupId]);
        if (validMembers.length) {
            await connection.query(
                'INSERT INTO approval_service_group_members (group_id, user_id) VALUES ?',
                [validMembers.map((userId) => [groupId, userId])]
            );
        }
        await connection.commit();
        res.json({ success: true, message: 'Service group updated' });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'A group with this service type already exists for that role' });
        }
        console.error('Update approval service group error:', error);
        res.status(500).json({ success: false, message: 'Unable to update service group' });
    } finally {
        if (connection) connection.release();
    }
};

exports.addGroupMember = async (req, res) => {
    const groupId = Number(req.params.groupId);
    const userId = Number(req.body.user_id);
    if (!isPositiveInteger(groupId) || !isPositiveInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Valid group and employee IDs are required' });
    }
    try {
        const [members] = await masterPool.query(
            `SELECT u.id
             FROM users u
             JOIN approval_service_groups g ON g.id = ? AND g.is_active = 1 AND g.member_type = 'worker'
             WHERE u.id = ? AND u.is_active = 1 AND u.is_ticket_employee = 1
               AND u.role = 'worker'`,
            [groupId, userId]
        );
        if (!members.length) {
            return res.status(400).json({ success: false, message: 'Only active Workers already registered in the app can be added' });
        }
        await masterPool.query(
            'INSERT INTO approval_service_group_members (group_id, user_id) VALUES (?, ?)',
            [groupId, userId]
        );
        res.status(201).json({ success: true, message: 'Employee added to service group' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Employee is already in this group' });
        }
        console.error('Add approval group member error:', error);
        res.status(500).json({ success: false, message: 'Unable to add employee to service group' });
    }
};

exports.removeGroupMember = async (req, res) => {
    const groupId = Number(req.params.groupId);
    const userId = Number(req.params.userId);
    if (!isPositiveInteger(groupId) || !isPositiveInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Valid group and employee IDs are required' });
    }
    let connection;
    try {
        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const [groups] = await connection.query(
            'SELECT id, member_type FROM approval_service_groups WHERE id = ? AND is_active = 1 FOR UPDATE',
            [groupId]
        );
        if (!groups.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Service group not found' });
        }
        if (groups[0].member_type !== 'worker') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Service types can only be assigned to Workers' });
        }
        const [pendingSteps] = await connection.query(
            `SELECT COUNT(*) AS count
             FROM complaint_approval_step_members sm
             JOIN complaint_approval_steps s ON s.id = sm.step_id AND s.state = 'pending'
             JOIN complaint_approval_instances i ON i.id = s.instance_id AND i.state = 'pending'
             WHERE (s.group_id = ? OR s.member_type = ?) AND sm.user_id = ?`,
            [groupId, groups[0].member_type, userId]
        );
        if (Number(pendingSteps[0].count) > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'This employee is assigned to pending approvals and cannot be removed yet' });
        }
        const [legacyWorkflows] = await connection.query(
            `SELECT COUNT(*) AS count
             FROM approval_workflow_stages s
             JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
             WHERE s.group_id = ? AND s.member_type IS NULL`,
            [groupId]
        );
        const [roleWorkflows] = await connection.query(
            `SELECT COUNT(*) AS count
             FROM approval_workflow_stages s
             JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
             WHERE s.member_type = ?`,
            [groups[0].member_type]
        );
        const [remainingMembers] = await connection.query(
            `SELECT COUNT(DISTINCT u.id) AS count
             FROM approval_service_group_members gm
             JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
             JOIN users u ON u.id = gm.user_id AND u.is_active = 1
               AND u.is_ticket_employee = 1
             WHERE g.member_type = ?
               AND NOT (gm.group_id = ? AND gm.user_id = ?)`,
            [groups[0].member_type, groupId, userId]
        );
        const [remainingGroupMembers] = await connection.query(
            `SELECT COUNT(DISTINCT u.id) AS count
             FROM approval_service_group_members gm
             JOIN users u ON u.id = gm.user_id AND u.is_active = 1
               AND u.is_ticket_employee = 1
             WHERE gm.group_id = ? AND gm.user_id <> ?`,
            [groupId, userId]
        );
        if ((Number(legacyWorkflows[0].count) > 0 &&
                Number(remainingGroupMembers[0].count) === 0) ||
            (Number(roleWorkflows[0].count) > 0 &&
                Number(remainingMembers[0].count) === 0)) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'An active approval flow must retain at least one eligible member for this role' });
        }
        const [result] = await connection.query(
            'DELETE FROM approval_service_group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        await connection.commit();
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Group member not found' });
        res.json({ success: true, message: 'Employee removed from service group' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Remove approval group member error:', error);
        res.status(500).json({ success: false, message: 'Unable to remove employee from service group' });
    } finally {
        if (connection) connection.release();
    }
};

exports.deactivateGroup = async (req, res) => {
    const groupId = Number(req.params.groupId);
    if (!isPositiveInteger(groupId)) {
        return res.status(400).json({ success: false, message: 'Valid group ID is required' });
    }
    try {
        const [groups] = await masterPool.query(
            'SELECT id, member_type FROM approval_service_groups WHERE id = ? AND is_active = 1',
            [groupId]
        );
        if (!groups.length) return res.status(404).json({ success: false, message: 'Service group not found' });
        const memberType = groups[0].member_type;
        if (memberType !== 'worker') {
            return res.status(409).json({ success: false, message: 'Only Worker service types can be managed' });
        }
        const [legacyUsage] = await masterPool.query(
            `SELECT
                (SELECT COUNT(*) FROM approval_workflow_stages s
                 JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
                 WHERE s.group_id = ? AND s.member_type IS NULL) AS active_workflows,
                (SELECT COUNT(*) FROM complaint_approval_steps s
                 JOIN complaint_approval_instances i ON i.id = s.instance_id AND i.state = 'pending'
                 WHERE s.group_id = ? AND s.member_type IS NULL) AS pending_approvals`,
            [groupId, groupId]
        );
        const [roleWorkflowRows] = await masterPool.query(
            `SELECT COUNT(*) AS count
             FROM approval_workflow_stages s
             JOIN approval_workflows w ON w.id = s.workflow_id AND w.is_active = 1
             WHERE s.member_type = ?`,
            [memberType]
        );
        const [remainingMembers] = await masterPool.query(
            `SELECT COUNT(DISTINCT u.id) AS count
             FROM approval_service_group_members gm
             JOIN approval_service_groups g ON g.id = gm.group_id AND g.is_active = 1
             JOIN users u ON u.id = gm.user_id AND u.is_active = 1
               AND u.is_ticket_employee = 1
             WHERE g.member_type = ? AND g.id <> ?`,
            [memberType, groupId]
        );
        if (Number(legacyUsage[0].active_workflows) ||
            Number(legacyUsage[0].pending_approvals) ||
            (Number(roleWorkflowRows[0].count) > 0 && Number(remainingMembers[0].count) === 0)) {
            return res.status(409).json({ success: false, message: 'Remove this group from active flows and pending approvals before deleting it' });
        }
        const [result] = await masterPool.query(
            'UPDATE approval_service_groups SET is_active = 0 WHERE id = ? AND is_active = 1',
            [groupId]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Service group not found' });
        res.json({ success: true, message: 'Service group deleted' });
    } catch (error) {
        console.error('Deactivate approval service group error:', error);
        res.status(500).json({ success: false, message: 'Unable to delete service group' });
    }
};

exports.deactivateWorkflow = async (req, res) => {
    const scopeType = req.body.scope_type;
    const categoryId = req.body.category_id == null || req.body.category_id === ''
        ? null
        : Number(req.body.category_id);
    if (!['default', 'category'].includes(scopeType) ||
        (scopeType === 'default' && categoryId !== null) ||
        (scopeType === 'category' && !isPositiveInteger(categoryId))) {
        return res.status(400).json({ success: false, message: 'Valid flow scope is required' });
    }
    try {
        const scopeKey = scopeType === 'default' ? 'default' : `category:${categoryId}`;
        const [result] = await masterPool.query(
            'UPDATE approval_workflows SET is_active = 0 WHERE scope_key = ? AND is_active = 1',
            [scopeKey]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Approval flow not found' });
        res.json({ success: true, message: 'Approval flow removed; existing complaints keep their current stages' });
    } catch (error) {
        console.error('Deactivate approval workflow error:', error);
        res.status(500).json({ success: false, message: 'Unable to remove approval flow' });
    }
};

exports.saveWorkflow = async (req, res) => {
    const scopeType = req.body.scope_type;
    const categoryId = req.body.category_id == null || req.body.category_id === ''
        ? null
        : Number(req.body.category_id);
    const name = String(req.body.name || '').trim();
    const stages = Array.isArray(req.body.stages) ? req.body.stages : [];
    if (!['default', 'category'].includes(scopeType) || !name || name.length > 150 ||
        (scopeType === 'default' && categoryId !== null) ||
        (scopeType === 'category' && !isPositiveInteger(categoryId)) ||
        stages.length === 0 || stages.length > 20 ||
        stages.some((stage) =>
            !stage || typeof stage !== 'object' ||
            !['manager', 'worker', 'sub_admin', 'super_admin'].includes(stage.member_type) ||
            String(stage.stage_name || '').trim().length > 150
        )) {
        return res.status(400).json({ success: false, message: 'A valid flow scope, name, and 1-20 valid approval stages are required' });
    }

    let connection;
    try {
        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        if (scopeType === 'category') {
            const [categories] = await connection.query(
                'SELECT id FROM categories WHERE id = ? AND parent_id IS NULL AND is_active = 1',
                [categoryId]
            );
            if (!categories.length) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Select an active complaint category' });
            }
        }
        const scopeKey = scopeType === 'default' ? 'default' : `category:${categoryId}`;
        const [workflows] = await connection.query(
            'SELECT id FROM approval_workflows WHERE scope_key = ? FOR UPDATE',
            [scopeKey]
        );
        let workflowId;
        if (workflows.length) {
            workflowId = workflows[0].id;
            await connection.query(
                'UPDATE approval_workflows SET name = ?, is_active = 1 WHERE id = ?',
                [name, workflowId]
            );
        } else {
            const [result] = await connection.query(
                'INSERT INTO approval_workflows (scope_key, scope_type, category_id, name) VALUES (?, ?, ?, ?)',
                [scopeKey, scopeType, categoryId, name]
            );
            workflowId = result.insertId;
        }
        await connection.query('DELETE FROM approval_workflow_stages WHERE workflow_id = ?', [workflowId]);
        const stageValues = stages.map((stage, index) => [
            workflowId,
            index + 1,
            String(stage.stage_name || '').trim() || `Stage ${index + 1}`,
            stage.member_type
        ]);
        await connection.query(
            `INSERT INTO approval_workflow_stages (workflow_id, stage_order, stage_name, member_type)
             VALUES ?`,
            [stageValues]
        );
        await connection.commit();
        res.json({ success: true, message: 'Approval flow saved', data: { id: workflowId } });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Save approval workflow error:', error);
        if (
            ['WARN_DATA_TRUNCATED', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'].includes(error.code) ||
            ([1265, 1366].includes(error.errno) && /member_type/i.test(error.sqlMessage || ''))
        ) {
            return res.status(409).json({
                success: false,
                message: 'The database has not been upgraded for Sub-admin and Superadmin approval stages. Apply migration 016 (or SQL script 017) and retry.'
            });
        }
        res.status(500).json({ success: false, message: 'Unable to save approval flow' });
    } finally {
        if (connection) connection.release();
    }
};
