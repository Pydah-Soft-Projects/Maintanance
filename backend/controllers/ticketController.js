const { masterPool } = require('../config/database');
const { getHRMSConnection } = require('../config/mongoConfig');
const { getModel: getHRMSEmployeeModel } = require('../models/HRMSEmployee');
const mongoose = require('mongoose');
const { getEligibleApprovers } = require('../utils/approvalApprovers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const directory = path.join(__dirname, '..', 'uploads', 'tickets');
        fs.mkdirSync(directory, { recursive: true });
        cb(null, directory);
    },
    filename: (_req, file, cb) => {
        cb(null, `ticket-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpe?g|png|gif|webp)$/i.test(path.extname(file.originalname)) &&
            /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
        cb(allowed ? null : new Error('Only image files are allowed'), allowed);
    }
});

exports.upload = upload;

const ALL_COMPLAINT_ROLES = new Set(['manager', 'sub_admin', 'super_admin']);
const parseJson = (value, fallback = []) => {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Invalid JSON stored on complaint:', error.message);
        return fallback;
    }
};
const isRequester = (user) => user?.role === 'student' || user?.ticketAccess === 'request' ||
    (user?.is_hrms_session && !user?.id);
const hasActiveAssignment = (row, userId) => parseJson(row.assignments)
    .some((assignment) => assignment.is_active !== false &&
        Number(assignment.assigned_to) === Number(userId));

const createTicketNumber = () =>
    `TKT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

const requesterPredicate = (user) => {
    if (user.role === 'student' || user.admission_number || user.admissionNumber) {
        return { column: 'requester_identifier', value: user.admission_number || user.admissionNumber };
    }
    if (user.is_hrms_session || user.hrmsId) {
        return { column: 'requester_hrms_id', value: user.hrmsId || null };
    }
    return { column: 'requester_user_id', value: user.id };
};

const enrichComplaints = async (rows, viewer = null) => {
    if (!rows.length) return [];
    const userIds = new Set();
    rows.forEach((row) => {
        parseJson(row.assignments).forEach((assignment) => {
            if (assignment.assigned_to) userIds.add(Number(assignment.assigned_to));
            if (assignment.assigned_by) userIds.add(Number(assignment.assigned_by));
        });
        parseJson(row.comments).forEach((comment) => {
            if (comment.user_id) userIds.add(Number(comment.user_id));
        });
        parseJson(row.status_history).forEach((entry) => {
            if (entry.changed_by) userIds.add(Number(entry.changed_by));
        });
    });

    const usersById = new Map();
    if (userIds.size) {
        const [users] = await masterPool.query(
            'SELECT id, name, username, email, phone, role FROM users WHERE id IN (?)',
            [[...userIds]]
        );
        users.forEach((user) => usersById.set(Number(user.id), user));
    }

    const complaintIds = rows.map((row) => Number(row.id));
    const [approvalRows] = await masterPool.query(
        `SELECT i.complaint_id, i.state, i.current_stage_order,
                s.stage_name AS current_stage_name,
                COALESCE(s.member_type, g.member_type) AS member_type,
                CASE WHEN s.member_type IS NULL THEN g.service_type ELSE NULL END AS service_type,
                EXISTS (
                    SELECT 1
                    FROM complaint_approval_step_members sm
                    JOIN users approver ON approver.id = sm.user_id
                    WHERE sm.step_id = s.id AND sm.user_id = ?
                      AND approver.is_active = 1 AND approver.is_ticket_employee = 1
                ) AS can_act
         FROM complaint_approval_instances i
         LEFT JOIN complaint_approval_steps s
           ON s.instance_id = i.id AND s.stage_order = i.current_stage_order
         LEFT JOIN approval_service_groups g ON g.id = s.group_id
         WHERE i.complaint_id IN (?)`,
        [viewer?.id || null, complaintIds]
    );
    const approvalsByComplaint = new Map(approvalRows.map((approval) => [
        Number(approval.complaint_id),
        {
            state: approval.state,
            current_stage_order: approval.current_stage_order,
            current_stage_name: approval.current_stage_name,
            member_type: approval.member_type,
            service_type: approval.service_type,
            can_act: Boolean(approval.can_act)
        }
    ]));

    return rows.map((row) => {
        const assignments = parseJson(row.assignments).map((assignment) => ({
            ...assignment,
            assigned_to_name: usersById.get(Number(assignment.assigned_to))?.name ||
                assignment.assigned_to_name || assignment.name || null,
            assigned_to_username: usersById.get(Number(assignment.assigned_to))?.username || null,
            assigned_to_email: usersById.get(Number(assignment.assigned_to))?.email || null,
            assigned_to_phone: usersById.get(Number(assignment.assigned_to))?.phone ||
                assignment.assigned_to_phone || assignment.phone || null,
            assigned_to_identifier: usersById.get(Number(assignment.assigned_to))?.username ||
                assignment.assigned_to_identifier || assignment.employee_no || null,
            assigned_to_role: usersById.get(Number(assignment.assigned_to))?.role ||
                assignment.assigned_to_role || (assignment.assignment_type ? 'worker' : null),
            assigned_by_name: usersById.get(Number(assignment.assigned_by))?.name || null
        })).filter((assignment) => assignment.is_active !== false);
        const comments = parseJson(row.comments).map((comment) => ({
            ...comment,
            user_name: usersById.get(Number(comment.user_id))?.name || comment.user_name || null,
            user_identifier: usersById.get(Number(comment.user_id))?.username || comment.user_identifier || null
        }));
        const statusHistory = parseJson(row.status_history).map((entry) => ({
            ...entry,
            changed_by_name: usersById.get(Number(entry.changed_by))?.name || null,
            changed_by_username: usersById.get(Number(entry.changed_by))?.username || null
        }));
        return {
            ...row,
            ticket_id: row.complaint_number,
            ticket_number: row.complaint_number,
            student_id: row.requester_user_id,
            student_name: row.requester_name,
            student_mobile: row.requester_phone,
            admission_number: row.requester_identifier,
            raised_by_rbac_id: row.requester_user_id,
            raised_by_hrms_id: row.requester_hrms_id,
            requester_display_name: row.requester_name,
            has_photo: row.photo_url ? 1 : 0,
            assignments,
            comments,
            status_history: statusHistory,
            approval: approvalsByComplaint.get(Number(row.id)) || null,
            feedback: parseJson(row.feedback, null)
        };
    });
};

const getComplaintRow = async (id) => {
    const [rows] = await masterPool.query(
        `SELECT c.*, cat.name AS category_name, sub.name AS sub_category_name
         FROM complaints c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN categories sub ON c.sub_category_id = sub.id
         WHERE c.id = ?`,
        [id]
    );
    return rows[0] || null;
};

const saveComplaintJson = async (id, column, value) => {
    const allowedColumns = ['assignments', 'comments', 'status_history', 'feedback'];
    if (!allowedColumns.includes(column)) throw new Error('Invalid complaint field');
    await masterPool.query(
        `UPDATE complaints SET ${column} = ?, updated_at = NOW() WHERE id = ?`,
        [value == null ? null : JSON.stringify(value), id]
    );
};

const appendStatus = async (row, status, changedBy, notes) => {
    const history = parseJson(row.status_history);
    history.unshift({
        id: Date.now(),
        old_status: row.status,
        new_status: status,
        changed_by: changedBy || null,
        notes: notes || null,
        created_at: new Date().toISOString()
    });
    await masterPool.query(
        `UPDATE complaints
         SET status = ?, status_history = ?, resolved_at = ?,
             closed_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [
            status,
            JSON.stringify(history),
            status === 'completed' ? new Date() : (status === 'pending' ? null : row.resolved_at),
            status === 'closed' ? new Date() : (status === 'pending' ? null : row.closed_at),
            row.id
        ]
    );
};

const getApprovalWorkflow = async (categoryId) => {
    const scopeKeys = [`category:${categoryId}`, 'default'];
    for (const scopeKey of scopeKeys) {
        const [workflows] = await masterPool.query(
            'SELECT id FROM approval_workflows WHERE scope_key = ? AND is_active = 1',
            [scopeKey]
        );
        if (!workflows.length) continue;

        const workflowId = workflows[0].id;
        const [stages] = await masterPool.query(
            `SELECT s.stage_order, s.stage_name, s.group_id,
                    COALESCE(s.member_type, g.member_type) AS member_type
             FROM approval_workflow_stages s
             LEFT JOIN approval_service_groups g ON g.id = s.group_id AND g.is_active = 1
             WHERE s.workflow_id = ?
             ORDER BY s.stage_order`,
            [workflowId]
        );
        if (!stages.length) throw new Error('Configured approval flow has no stages');
        const memberTypes = [...new Set(stages.map((stage) => stage.member_type).filter(Boolean))];
        const members = await getEligibleApprovers(masterPool, memberTypes);
        const membersByRole = new Map();
        members.forEach((member) => {
            const roleMembers = membersByRole.get(member.member_type) || [];
            roleMembers.push(Number(member.id));
            membersByRole.set(member.member_type, roleMembers);
        });
        if (stages.some((stage) => !membersByRole.get(stage.member_type)?.length)) {
            throw new Error('Configured approval flow contains a role or group with no active HRMS employees');
        }
        return {
            id: workflowId,
            stages: stages.map((stage) => ({
                ...stage,
                member_ids: [...new Set(membersByRole.get(stage.member_type))]
            }))
        };
    }
    return null;
};

exports.createTicket = async (req, res) => {
    try {
        const user = req.user || req.student;
        const { category_id, sub_category_id, title, description, college_id, college_name, college, block_no, floor_no, room_no } = req.body;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        if (!category_id || !title?.trim()) {
            return res.status(400).json({ success: false, message: 'Category and title are required' });
        }

        const [categories] = await masterPool.query(
            'SELECT id, parent_id, is_active FROM categories WHERE id = ? AND is_active = 1',
            [category_id]
        );
        if (!categories.length) return res.status(400).json({ success: false, message: 'Invalid complaint category' });
        if (sub_category_id) {
            const [subcategories] = await masterPool.query(
                'SELECT id FROM categories WHERE id = ? AND parent_id = ? AND is_active = 1',
                [sub_category_id, category_id]
            );
            if (!subcategories.length) return res.status(400).json({ success: false, message: 'Invalid sub-category for selected category' });
        }

        const isStudent = user.role === 'student' || user.admission_number || user.admissionNumber;
        const isHrms = Boolean(user.is_hrms_session || user.hrmsId || user.is_hrms_user);
        const userId = Number(user.id) || null;
        const admissionNumber = user.admission_number || user.admissionNumber || null;
        if (isStudent && !admissionNumber) {
            return res.status(400).json({ success: false, message: 'Student admission number is missing from the authenticated profile' });
        }
        const requester = !isStudent && userId
            ? { id: userId, name: user.name, username: user.username }
            : null;
        const requesterType = isStudent ? 'student' : 'staff';
        const requestedReferenceSite = String(req.body.reference_site || '').trim().toUpperCase();
        const validReferenceSites = isStudent
            ? new Set(['SDMS', 'HMS'])
            : new Set(['HRMS']);
        if (requestedReferenceSite && !validReferenceSites.has(requestedReferenceSite)) {
            return res.status(400).json({
                success: false,
                message: isStudent
                    ? 'Student complaints must use the SDMS or HMS reference site'
                    : 'Faculty complaints must use the HRMS reference site'
            });
        }
        const referenceSite = requestedReferenceSite || (isStudent ? 'SDMS' : 'HRMS');
        const requesterIdentifier = isStudent
            ? admissionNumber
            : (user.username || user.email || (user.hrmsId ? `HRMS-${user.hrmsId}` : `STAFF-${userId || Date.now()}`));
        const requesterName = user.name || 'User';
        const photoUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;
        const workflow = await getApprovalWorkflow(category_id);
        let autoAssignedEmployees = [];
        if (!workflow) {
            const [employees] = await masterPool.query(
                `SELECT id, assigned_categories FROM users
                 WHERE is_ticket_employee = 1 AND is_active = 1 AND role = 'manager'`
            );
            autoAssignedEmployees = employees.filter((employee) =>
                parseJson(employee.assigned_categories).map(Number).includes(Number(category_id))
            );
        }

        const connection = await masterPool.getConnection();
        let complaintId;
        try {
            await connection.beginTransaction();
            const assignments = workflow ? [] : autoAssignedEmployees.map((employee) => ({
                id: Date.now() + Number(employee.id),
                assigned_to: Number(employee.id),
                assigned_by: null,
                notes: 'Auto-assigned based on category',
                is_active: true,
                assigned_at: new Date().toISOString()
            }));
            const initialStatus = assignments.length ? 'approaching' : 'pending';
            const initialHistory = assignments.length ? [{
                id: Date.now(),
                old_status: 'pending',
                new_status: 'approaching',
                changed_by: null,
                notes: 'Auto-assigned based on category',
                created_at: new Date().toISOString()
            }] : [];
            const [result] = await connection.query(
                `INSERT INTO complaints
                 (complaint_number, requester_user_id, requester_type, reference_site, requester_hrms_id, requester_name,
                  requester_identifier, requester_phone, category_id, sub_category_id, college_id, college_name,
                  block_no, floor_no, room_no, title, description, photo_url, status,
                  assignments, comments, status_history)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
                [
                    createTicketNumber(),
                    requester?.id || null,
                    requesterType,
                    referenceSite,
                    isHrms && !isStudent ? user.hrmsId || null : null,
                    requesterName,
                    requesterIdentifier,
                    user.phone || user.phone_number || null,
                    category_id,
                    sub_category_id || null,
                    college_id || null,
                    college_name || college || null,
                    block_no || null,
                    floor_no || null,
                    room_no || null,
                    title.trim(),
                    description?.trim() || '',
                    photoUrl,
                    initialStatus,
                    JSON.stringify(assignments),
                    JSON.stringify(initialHistory)
                ]
            );
            complaintId = result.insertId;
            if (workflow) {
                const [instanceResult] = await connection.query(
                    `INSERT INTO complaint_approval_instances
                     (complaint_id, workflow_id, current_stage_order, state)
                     VALUES (?, ?, 1, 'pending')`,
                    [complaintId, workflow.id]
                );
                for (const stage of workflow.stages) {
                    const [stepResult] = await connection.query(
                        `INSERT INTO complaint_approval_steps
                         (instance_id, stage_order, stage_name, group_id, member_type)
                         VALUES (?, ?, ?, ?, ?)`,
                        [instanceResult.insertId, stage.stage_order, stage.stage_name, stage.group_id, stage.member_type]
                    );
                    await connection.query(
                        'INSERT INTO complaint_approval_step_members (step_id, user_id) VALUES ?',
                        [stage.member_ids.map((memberId) => [stepResult.insertId, memberId])]
                    );
                }
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        const row = await getComplaintRow(complaintId);
        res.status(201).json({ success: true, message: 'Complaint created successfully', data: (await enrichComplaints([row], user))[0] });
    } catch (error) {
        console.error('Error creating complaint:', error);
        const isFlowConfigError = error.message.startsWith('Configured approval flow');
        res.status(isFlowConfigError ? 409 : 500).json({
            success: false,
            message: isFlowConfigError ? error.message : 'Error creating complaint'
        });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const user = req.user || req.admin || req.student;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        const { status, category_id, assigned_to, student_id, requester_type, reference_site, page = 1, limit = 50 } = req.query;
        const conditions = [];
        const params = [];
        const joins = [];
        let assignmentAlias = null;
        const ensureAssignmentJoin = () => {
            if (!assignmentAlias) {
                assignmentAlias = 'ticket_assignments';
                joins.push(`JOIN JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                    assigned_user INT PATH '$.assigned_to',
                    assignment_active BOOLEAN PATH '$.is_active'
                )) ${assignmentAlias} ON TRUE`);
            }
            return assignmentAlias;
        };
        if (isRequester(user)) {
            const predicate = requesterPredicate(user);
            if (predicate.value == null) {
                return res.status(403).json({ success: false, message: 'Requester identity is unavailable' });
            }
            conditions.push(`c.${predicate.column} = ?`);
            params.push(predicate.value);
        } else if (user.role === 'worker') {
            if (!user.id) return res.status(403).json({ success: false, message: 'Worker account is unavailable' });
            const alias = ensureAssignmentJoin();
            conditions.push(`${alias}.assigned_user = ? AND ${alias}.assignment_active = TRUE`);
            params.push(user.id);
        } else if (!ALL_COMPLAINT_ROLES.has(user.role)) {
            return res.status(403).json({ success: false, message: 'Your role cannot view the complaint queue' });
        }
        if (status) { conditions.push('c.status = ?'); params.push(status); }
        if (category_id) { conditions.push('c.category_id = ?'); params.push(category_id); }
        if (reference_site) {
            const normalizedReferenceSite = String(reference_site).trim().toUpperCase();
            if (!['SDMS', 'HMS', 'HRMS'].includes(normalizedReferenceSite)) {
                return res.status(400).json({ success: false, message: 'Reference site must be SDMS, HMS, or HRMS' });
            }
            conditions.push('c.reference_site = ?');
            params.push(normalizedReferenceSite);
        }
        if (student_id) {
            conditions.push('(c.requester_user_id = ? OR c.requester_identifier = ?)');
            params.push(student_id, student_id);
        }
        if (requester_type === 'student') conditions.push("c.requester_type = 'student'");
        if (requester_type === 'staff' || requester_type === 'faculty') conditions.push("c.requester_type = 'staff'");
        if (assigned_to) {
            const alias = ensureAssignmentJoin();
            conditions.push(`${alias}.assigned_user = ? AND ${alias}.assignment_active = TRUE`);
            params.push(Number(assigned_to));
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const from = `FROM complaints c ${joins.join(' ')}`;
        const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
        const offset = (pageNumber - 1) * pageSize;
        const [rows] = await masterPool.query(
            `SELECT DISTINCT c.*, cat.name AS category_name, sub.name AS sub_category_name
             ${from}
             LEFT JOIN categories cat ON c.category_id = cat.id
             LEFT JOIN categories sub ON c.sub_category_id = sub.id
             ${where}
             ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        const [countRows] = await masterPool.query(`SELECT COUNT(DISTINCT c.id) AS total ${from} ${where}`, params);
        res.json({
            success: true,
            data: await enrichComplaints(rows, req.user),
            pagination: { page: pageNumber, limit: pageSize, total: countRows[0].total, pages: Math.ceil(countRows[0].total / pageSize) }
        });
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaints', error: error.message });
    }
};

exports.getTicket = async (req, res) => {
    try {
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        const user = req.user || req.admin || req.student;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        if (isRequester(user)) {
            const predicate = requesterPredicate(user);
            if (predicate.value == null || String(row[predicate.column]) !== String(predicate.value)) {
                return res.status(403).json({ success: false, message: 'Access denied. You can only view your own complaints.' });
            }
        } else if (user.role === 'worker') {
            if (!hasActiveAssignment(row, user.id)) {
                return res.status(403).json({ success: false, message: 'Workers can only view complaints assigned to them.' });
            }
        } else if (!ALL_COMPLAINT_ROLES.has(user.role)) {
            return res.status(403).json({ success: false, message: 'Your role cannot view this complaint' });
        }
        const complaint = (await enrichComplaints([row], user))[0];
        if (isRequester(user)) {
            complaint.comments = complaint.comments.filter((comment) => !comment.is_internal);
        }
        res.json({ success: true, data: complaint });
    } catch (error) {
        console.error('Error fetching complaint:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaint', error: error.message });
    }
};

exports.getStudentTickets = async (req, res) => {
    try {
        const user = req.user || req.student;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        const predicate = requesterPredicate(user);
        const [rows] = await masterPool.query(
            `SELECT c.*, cat.name AS category_name, sub.name AS sub_category_name
             FROM complaints c
             LEFT JOIN categories cat ON c.category_id = cat.id
             LEFT JOIN categories sub ON c.sub_category_id = sub.id
             WHERE c.${predicate.column} = ?
             ORDER BY c.created_at DESC`,
            [predicate.value]
        );
        res.json({ success: true, data: await enrichComplaints(rows, user) });
    } catch (error) {
        console.error('Error fetching requester complaints:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaints', error: error.message });
    }
};

exports.assignTicket = async (req, res) => {
    try {
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        if (row.status === 'rejected') {
            return res.status(409).json({ success: false, message: 'Rejected complaints cannot be assigned' });
        }
        const [pendingApprovals] = await masterPool.query(
            `SELECT id
             FROM complaint_approval_instances
             WHERE complaint_id = ? AND state = 'pending'`,
            [row.id]
        );
        if (pendingApprovals.length) {
            return res.status(409).json({ success: false, message: 'This complaint must finish its approval flow before assignment' });
        }
        const assignedTo = req.body.assigned_to ?? [];
        const hrmsAssignees = req.body.hrms_assignees ?? [];
        const externalAssignees = req.body.external_assignees ?? [];
        if (!Array.isArray(assignedTo) || assignedTo.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
            return res.status(400).json({ success: false, message: 'assigned_to must contain valid user ids' });
        }
        if (!Array.isArray(hrmsAssignees) || !Array.isArray(externalAssignees)) {
            return res.status(400).json({ success: false, message: 'HRMS and external assignees must be arrays' });
        }
        const ids = [...new Set(assignedTo.map(Number))];
        let users = [];
        if (ids.length) {
            const [rows] = await masterPool.query('SELECT id FROM users WHERE id IN (?) AND is_active = 1', [ids]);
            users = rows.map((user) => Number(user.id));
            const missing = ids.filter((id) => !users.includes(id));
            if (missing.length) return res.status(400).json({ success: false, message: `Assigned user(s) not found: ${missing.join(', ')}` });
        }

        const requestedHrmsIds = [...new Set(hrmsAssignees.map((employee) => String(employee?.hrms_id || '').trim()))];
        if (requestedHrmsIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ success: false, message: 'Select valid employees from the HRMS directory' });
        }
        let hrmsEmployees = [];
        if (requestedHrmsIds.length) {
            const hrmsConnection = getHRMSConnection();
            if (!hrmsConnection) {
                return res.status(503).json({ success: false, message: 'HRMS database connection is unavailable' });
            }
            try {
                await hrmsConnection.asPromise();
                const HRMSEmployee = getHRMSEmployeeModel(hrmsConnection);
                hrmsEmployees = await HRMSEmployee.find({
                    _id: { $in: requestedHrmsIds },
                    is_active: { $ne: false }
                }).select('emp_no employee_name email phone_number').lean().exec();
            } catch (error) {
                console.error('Verify HRMS complaint assignees error:', error);
                return res.status(503).json({ success: false, message: 'Unable to verify selected HRMS employees' });
            }
            if (hrmsEmployees.length !== requestedHrmsIds.length) {
                return res.status(400).json({ success: false, message: 'One or more selected HRMS employees are no longer active' });
            }
        }

        const validatedExternalAssignees = externalAssignees.map((person) => ({
            name: typeof person?.name === 'string' ? person.name.trim() : '',
            phone: typeof person?.phone === 'string' ? person.phone.trim() : ''
        }));
        const invalidExternal = validatedExternalAssignees.find(({ name, phone }) => {
            const phoneDigits = phone.replace(/\D/g, '');
            return !name || name.length > 150 || !/^[+0-9().\-\s]+$/.test(phone) ||
                phoneDigits.length < 7 || phoneDigits.length > 15;
        });
        if (invalidExternal) {
            return res.status(400).json({ success: false, message: 'External workers need a name and a valid phone number' });
        }

        const assignedAt = new Date().toISOString();
        const assignmentIdBase = Date.now();
        const assignments = [
            ...users.map((id) => ({
                id,
                assigned_to: id,
                assigned_by: req.user?.id || null,
                notes: req.body.notes || null,
                is_active: true,
                assigned_at: assignedAt
            })),
            ...hrmsEmployees.map((employee) => ({
                assigned_to: null,
                assignment_type: 'hrms',
                assigned_to_hrms_id: employee._id.toString(),
                assigned_to_identifier: employee.emp_no || null,
                assigned_to_name: employee.employee_name || employee.emp_no || 'HRMS employee',
                assigned_to_phone: employee.phone_number || null,
                assigned_to_email: employee.email || null,
                assigned_to_role: 'worker',
                assigned_by: req.user?.id || null,
                notes: req.body.notes || null,
                is_active: true,
                assigned_at: assignedAt
            })),
            ...validatedExternalAssignees.map((person) => ({
                assigned_to: null,
                assignment_type: 'external',
                assigned_to_name: person.name,
                assigned_to_phone: person.phone,
                assigned_to_role: 'worker',
                assigned_by: req.user?.id || null,
                notes: req.body.notes || null,
                is_active: true,
                assigned_at: assignedAt
            }))
        ].map((assignment, index) => ({
            ...assignment,
            id: assignmentIdBase + index
        }));
        await saveComplaintJson(row.id, 'assignments', assignments);
        if (assignments.length && row.status === 'pending') await appendStatus(row, 'approaching', req.user?.id, 'Complaint assigned to staff');
        res.json({ success: true, message: assignments.length ? 'Complaint assigned successfully' : 'All assignees removed', data: { assignment_ids: assignments.map((item) => item.id) } });
    } catch (error) {
        console.error('Error assigning complaint:', error);
        res.status(500).json({ success: false, message: 'Error assigning complaint', error: error.message });
    }
};

exports.removeAssignment = async (req, res) => {
    try {
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        const assignments = parseJson(row.assignments);
        const assignment = assignments.find((item) => String(item.id) === String(req.params.assignmentId) && item.is_active !== false);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
        assignment.is_active = false;
        await saveComplaintJson(row.id, 'assignments', assignments);
        if (!assignments.some((item) => item.is_active !== false) && row.status === 'approaching') {
            await appendStatus(row, 'pending', req.user?.id, 'All assignees removed');
        }
        res.json({ success: true, message: 'Assignee removed successfully' });
    } catch (error) {
        console.error('Error removing complaint assignment:', error);
        res.status(500).json({ success: false, message: 'Error removing assignment', error: error.message });
    }
};

exports.changeTicketStatus = async (req, res) => {
    try {
        const validStatuses = ['pending', 'approaching', 'resolving', 'completed', 'closed'];
        const { status, notes } = req.body;
        if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        if (row.status === 'rejected') {
            return res.status(409).json({ success: false, message: 'Rejected complaints are terminal and cannot be reopened' });
        }
        const user = req.user || req.admin || req.student;
        if (user?.role === 'worker' && !hasActiveAssignment(row, user.id)) {
            return res.status(403).json({ success: false, message: 'Workers may only update complaints assigned to them' });
        }
        const [pendingApprovals] = await masterPool.query(
            `SELECT id
             FROM complaint_approval_instances
             WHERE complaint_id = ? AND state = 'pending'`,
            [row.id]
        );
        const requesterUser = isRequester(user);
        if (pendingApprovals.length && !requesterUser) {
            return res.status(409).json({ success: false, message: 'This complaint must finish its approval flow before its status can be changed' });
        }
        if (isRequester(user)) {
            const predicate = requesterPredicate(user);
            const ownsComplaint = predicate.value != null &&
                String(row[predicate.column]) === String(predicate.value);
            const isClosing = status === 'closed';
            const isReopening = status === 'pending' && (row.status === 'completed' || row.status === 'closed');
            if (!ownsComplaint || (!isClosing && !isReopening)) {
                return res.status(403).json({ success: false, message: 'Requesters may only close their complaints or re-raise completed ones' });
            }
        } else if (user?.role !== 'worker' && !ALL_COMPLAINT_ROLES.has(user?.role)) {
            return res.status(403).json({ success: false, message: 'Your role cannot update complaint status' });
        }
        await appendStatus(row, status, req.user?.id, notes);
        if (pendingApprovals.length && status === 'closed') {
            await masterPool.query(
                `UPDATE complaint_approval_instances
                 SET state = 'cancelled', completed_at = NOW()
                 WHERE id = ?`,
                [pendingApprovals[0].id]
            );
        }
        res.json({ success: true, message: 'Complaint status updated successfully' });
    } catch (error) {
        console.error('Error updating complaint status:', error);
        res.status(500).json({ success: false, message: 'Error updating complaint status', error: error.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const text = String(req.body.comment_text || '').trim();
        if (!text) return res.status(400).json({ success: false, message: 'Comment text is required' });
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        const user = req.user || req.admin || req.student;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        if (isRequester(user)) {
            const predicate = requesterPredicate(user);
            if (predicate.value == null || String(row[predicate.column]) !== String(predicate.value)) {
                return res.status(403).json({ success: false, message: 'You may only comment on your own complaints' });
            }
        } else if (user.role === 'worker') {
            if (!hasActiveAssignment(row, user.id)) {
                return res.status(403).json({ success: false, message: 'Workers may only comment on complaints assigned to them' });
            }
        } else if (!ALL_COMPLAINT_ROLES.has(user.role)) {
            return res.status(403).json({ success: false, message: 'Your role cannot comment on complaints' });
        }
        const comments = parseJson(row.comments);
        const comment = {
            id: Date.now(),
            ticket_id: row.id,
            user_id: user?.id || null,
            user_type: user?.role === 'student' ? 'student' : 'admin',
            comment_text: text,
            is_internal: !isRequester(user) && Boolean(req.body.is_internal),
            user_name: user?.name || user?.username || null,
            user_identifier: user?.admission_number || user?.username || null,
            created_at: new Date().toISOString()
        };
        comments.push(comment);
        await saveComplaintJson(row.id, 'comments', comments);
        res.status(201).json({ success: true, message: 'Comment added successfully', data: comment });
    } catch (error) {
        console.error('Error adding complaint comment:', error);
        res.status(500).json({ success: false, message: 'Error adding comment', error: error.message });
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const rating = Number(req.body.rating);
        const satisfied = typeof req.body.satisfied === 'boolean'
            ? req.body.satisfied
            : Number.isInteger(rating) && rating >= 1 && rating <= 5
                ? rating >= 4
                : null;
        const user = req.user || req.student;
        if (!user?.admission_number && !user?.admissionNumber) return res.status(401).json({ success: false, message: 'Student authentication required' });
        if (typeof satisfied !== 'boolean') return res.status(400).json({ success: false, message: 'Feedback must indicate whether the requester is satisfied' });
        const row = await getComplaintRow(req.params.id);
        const admissionNumber = user.admission_number || user.admissionNumber;
        if (!row || row.requester_identifier !== admissionNumber) return res.status(404).json({ success: false, message: 'Complaint not found or access denied' });
        if (row.status !== 'completed') return res.status(400).json({ success: false, message: 'Feedback can only be submitted for completed complaints' });
        const previousFeedback = parseJson(row.feedback, null);
        const previousSatisfaction = typeof previousFeedback?.satisfied === 'boolean'
            ? previousFeedback.satisfied
            : typeof previousFeedback?.is_satisfied === 'boolean'
                ? previousFeedback.is_satisfied
                : Number.isInteger(Number(previousFeedback?.rating))
                    ? Number(previousFeedback.rating) >= 4
                    : null;
        if (previousFeedback && previousSatisfaction !== false) {
            return res.status(400).json({ success: false, message: 'Feedback already submitted for this complaint' });
        }
        const feedback = {
            student_id: row.requester_user_id,
            satisfied,
            created_at: new Date().toISOString()
        };
        await saveComplaintJson(row.id, 'feedback', feedback);
        const nextStatus = satisfied ? 'closed' : 'pending';
        const statusNote = satisfied
            ? 'Complaint closed after requester confirmed the resolution'
            : 'Reopened after requester reported the resolution was not satisfactory';
        const freshRow = { ...row, feedback: JSON.stringify(feedback) };
        await appendStatus(freshRow, nextStatus, user.id, statusNote);
        res.status(201).json({
            success: true,
            message: satisfied ? 'Feedback submitted successfully' : 'Feedback recorded and complaint reopened',
            data: { satisfied }
        });
    } catch (error) {
        console.error('Error submitting complaint feedback:', error);
        res.status(500).json({ success: false, message: 'Error submitting feedback', error: error.message });
    }
};

exports.getTicketStats = async (req, res) => {
    try {
        const user = req.user || req.admin || req.student;
        if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
        let scope = '';
        let params = [];
        let assignmentJoin = '';
        if (isRequester(user)) {
            const predicate = requesterPredicate(user);
            if (predicate.value == null) {
                return res.status(403).json({ success: false, message: 'Requester identity is unavailable' });
            }
            scope = `WHERE c.${predicate.column} = ?`;
            params = [predicate.value];
        } else if (user.role === 'worker') {
            assignmentJoin = `JOIN JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                assigned_user INT PATH '$.assigned_to',
                assignment_active BOOLEAN PATH '$.is_active'
            )) ticket_assignments ON TRUE`;
            scope = 'WHERE ticket_assignments.assigned_user = ? AND ticket_assignments.assignment_active = TRUE';
            params = [user.id];
        } else if (!ALL_COMPLAINT_ROLES.has(user.role)) {
            return res.status(403).json({ success: false, message: 'Your role cannot view complaint statistics' });
        }
        const [statusRows] = await masterPool.query(
            `SELECT c.status, COUNT(DISTINCT c.id) AS count
             FROM complaints c ${assignmentJoin} ${scope}
             GROUP BY c.status`,
            params
        );
        const [categoryRows] = await masterPool.query(
            `SELECT cat.id AS category_id, cat.name AS category_name, COUNT(DISTINCT scoped.id) AS count
             FROM categories cat
             LEFT JOIN (
                 SELECT c.id, c.category_id
                 FROM complaints c ${assignmentJoin} ${scope}
             ) scoped ON scoped.category_id = cat.id
             GROUP BY cat.id, cat.name ORDER BY count DESC`,
            params
        );
        const byStatus = statusRows.map((row) => ({ status: row.status, count: Number(row.count) }));
        const total = byStatus.reduce((sum, row) => sum + row.count, 0);
        res.json({ success: true, data: { total, by_status: byStatus, by_category: categoryRows } });
    } catch (error) {
        console.error('Error fetching complaint stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaint statistics', error: error.message });
    }
};
