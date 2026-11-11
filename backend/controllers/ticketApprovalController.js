const { masterPool } = require('../config/database');

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const parseJson = (value, fallback = []) => {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Invalid complaint assignments JSON:', error.message);
        return fallback;
    }
};

const canViewComplaint = (user, complaint) => {
    if (!user) return false;
    const isRequester = user.ticketAccess === 'request' || user.role === 'student' ||
        (user.is_hrms_session && !user.id);
    if (isRequester) {
        return (user.admission_number || user.admissionNumber)
            ? String(complaint.requester_identifier) === String(user.admission_number || user.admissionNumber)
            : (user.hrmsId && String(complaint.requester_hrms_id) === String(user.hrmsId)) ||
                (user.id && Number(complaint.requester_user_id) === Number(user.id));
    }
    if (user.role === 'worker') {
        return parseJson(complaint.assignments).some((assignment) =>
            assignment.is_active !== false && Number(assignment.assigned_to) === Number(user.id)
        );
    }
    return ['manager', 'sub_admin', 'super_admin'].includes(user.role);
};

exports.getApprovalDetails = async (req, res) => {
    const complaintId = Number(req.params.id);
    if (!isPositiveInteger(complaintId)) {
        return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }
    try {
        const user = req.user || req.student;
        const [complaints] = await masterPool.query(
            `SELECT id, requester_identifier, requester_hrms_id, requester_user_id, assignments
             FROM complaints WHERE id = ?`,
            [complaintId]
        );
        if (!complaints.length) return res.status(404).json({ success: false, message: 'Complaint not found' });
        if (!canViewComplaint(user, complaints[0])) {
            return res.status(403).json({ success: false, message: 'You cannot view approvals for this complaint' });
        }
        const [instances] = await masterPool.query(
            `SELECT id, complaint_id, workflow_id, current_stage_order, state, created_at, completed_at
             FROM complaint_approval_instances
             WHERE complaint_id = ?`,
            [complaintId]
        );
        if (!instances.length) return res.json({ success: true, data: null });
        const instance = instances[0];
        const [steps] = await masterPool.query(
            `SELECT s.id, s.stage_order, s.stage_name, s.group_id, s.state,
                    s.decision_by, s.decision_notes, s.created_at, s.decided_at,
                    COALESCE(s.member_type, g.member_type) AS member_type,
                    CASE WHEN s.member_type IS NULL THEN g.service_type ELSE NULL END AS service_type,
                    decider.name AS decision_by_name
             FROM complaint_approval_steps s
             LEFT JOIN approval_service_groups g ON g.id = s.group_id
             LEFT JOIN users decider ON decider.id = s.decision_by
             WHERE s.instance_id = ?
             ORDER BY s.stage_order`,
            [instance.id]
        );
        const pendingStep = steps.find((step) =>
            step.stage_order === instance.current_stage_order && step.state === 'pending'
        );
        let canAct = false;
        if (pendingStep && isPositiveInteger(user?.id)) {
            const [members] = await masterPool.query(
                `SELECT sm.user_id
                 FROM complaint_approval_step_members sm
                 JOIN users u ON u.id = sm.user_id
                 WHERE sm.step_id = ? AND sm.user_id = ? AND u.is_active = 1 AND u.is_ticket_employee = 1
                   AND u.role = ?`,
                [pendingStep.id, Number(user.id), pendingStep.member_type]
            );
            canAct = members.length > 0;
        }
        res.json({
            success: true,
            data: {
                ...instance,
                current_stage: pendingStep ? {
                    id: pendingStep.id,
                    stage_order: pendingStep.stage_order,
                    stage_name: pendingStep.stage_name,
                    member_type: pendingStep.member_type,
                    service_type: pendingStep.service_type
                } : null,
                can_act: canAct,
                steps: steps.map((step) => ({
                    id: step.id,
                    stage_order: step.stage_order,
                    stage_name: step.stage_name,
                    member_type: step.member_type,
                    service_type: step.service_type,
                    state: step.state,
                    decision_by_name: step.decision_by_name,
                    decision_notes: step.decision_notes,
                    decided_at: step.decided_at
                }))
            }
        });
    } catch (error) {
        console.error('Get complaint approval details error:', error);
        res.status(500).json({ success: false, message: 'Unable to load complaint approvals' });
    }
};

exports.decideApproval = async (req, res) => {
    const complaintId = Number(req.params.id);
    const userId = Number(req.user?.id);
    const decision = req.body.decision;
    const notes = String(req.body.notes || '').trim();
    if (!isPositiveInteger(complaintId) || !isPositiveInteger(userId) ||
        !['approved', 'rejected'].includes(decision) ||
        (decision === 'rejected' && !notes)) {
        return res.status(400).json({
            success: false,
            message: 'A valid complaint, approval decision, and rejection reason are required'
        });
    }

    let connection;
    try {
        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const [complaints] = await connection.query(
            'SELECT id, status, status_history FROM complaints WHERE id = ? FOR UPDATE',
            [complaintId]
        );
        if (!complaints.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Complaint not found' });
        }
        const [instances] = await connection.query(
            `SELECT id, current_stage_order, state
             FROM complaint_approval_instances
             WHERE complaint_id = ?
             FOR UPDATE`,
            [complaintId]
        );
        if (!instances.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No approval flow is configured for this complaint' });
        }
        const instance = instances[0];
        if (instance.state !== 'pending') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'This approval flow is no longer active' });
        }
        const [steps] = await connection.query(
            `SELECT s.id, s.stage_order, s.state,
                    COALESCE(
                        s.member_type,
                        (SELECT g.member_type FROM approval_service_groups g WHERE g.id = s.group_id)
                    ) AS member_type
             FROM complaint_approval_steps s
             WHERE s.instance_id = ? AND s.stage_order = ?
             FOR UPDATE`,
            [instance.id, instance.current_stage_order]
        );
        const step = steps[0];
        if (!step || step.state !== 'pending') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'The current approval stage is unavailable' });
        }
        const [members] = await connection.query(
            `SELECT sm.user_id
             FROM complaint_approval_step_members sm
             JOIN users u ON u.id = sm.user_id
             WHERE sm.step_id = ? AND sm.user_id = ?
               AND u.is_active = 1 AND u.is_ticket_employee = 1 AND u.role = ?
             FOR UPDATE`,
            [step.id, userId, step.member_type]
        );
        if (!members.length) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'You are not assigned to the current approval stage' });
        }

        await connection.query(
            `UPDATE complaint_approval_steps
             SET state = ?, decision_by = ?, decision_notes = ?, decided_at = NOW()
             WHERE id = ?`,
            [decision, userId, notes || null, step.id]
        );
        if (decision === 'rejected') {
            await connection.query(
                `UPDATE complaint_approval_steps
                 SET state = 'skipped'
                 WHERE instance_id = ? AND stage_order > ? AND state = 'pending'`,
                [instance.id, step.stage_order]
            );
            await connection.query(
                `UPDATE complaint_approval_instances
                 SET state = 'rejected', completed_at = NOW()
                 WHERE id = ?`,
                [instance.id]
            );
            const complaint = complaints[0];
            const history = typeof complaint.status_history === 'string'
                ? JSON.parse(complaint.status_history || '[]')
                : (complaint.status_history || []);
            history.unshift({
                id: Date.now(),
                old_status: complaint.status,
                new_status: 'rejected',
                changed_by: userId,
                notes,
                created_at: new Date().toISOString()
            });
            await connection.query(
                `UPDATE complaints
                 SET status = 'rejected', status_history = ?, updated_at = NOW()
                 WHERE id = ?`,
                [JSON.stringify(history), complaintId]
            );
        } else {
            const [nextSteps] = await connection.query(
                `SELECT stage_order
                 FROM complaint_approval_steps
                 WHERE instance_id = ? AND stage_order > ? AND state = 'pending'
                 ORDER BY stage_order
                 LIMIT 1`,
                [instance.id, step.stage_order]
            );
            if (nextSteps.length) {
                await connection.query(
                    'UPDATE complaint_approval_instances SET current_stage_order = ? WHERE id = ?',
                    [nextSteps[0].stage_order, instance.id]
                );
            } else {
                await connection.query(
                    `UPDATE complaint_approval_instances
                     SET state = 'approved', completed_at = NOW()
                     WHERE id = ?`,
                    [instance.id]
                );
            }
        }
        await connection.commit();
        res.json({
            success: true,
            message: decision === 'approved' ? 'Approval recorded' : 'Complaint rejected'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Record complaint approval decision error:', error);
        res.status(500).json({ success: false, message: 'Unable to record approval decision' });
    } finally {
        if (connection) connection.release();
    }
};
