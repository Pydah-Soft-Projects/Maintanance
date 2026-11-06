const { masterPool } = require('../config/database');
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

const enrichComplaints = async (rows) => {
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
            'SELECT id, name, username, email, role FROM users WHERE id IN (?)',
            [[...userIds]]
        );
        users.forEach((user) => usersById.set(Number(user.id), user));
    }

    return rows.map((row) => {
        const assignments = parseJson(row.assignments).map((assignment) => ({
            ...assignment,
            assigned_to_name: usersById.get(Number(assignment.assigned_to))?.name || null,
            assigned_to_username: usersById.get(Number(assignment.assigned_to))?.username || null,
            assigned_to_email: usersById.get(Number(assignment.assigned_to))?.email || null,
            assigned_to_role: usersById.get(Number(assignment.assigned_to))?.role || null,
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
        const requesterIdentifier = isStudent
            ? admissionNumber
            : (user.username || user.email || (user.hrmsId ? `HRMS-${user.hrmsId}` : `STAFF-${userId || Date.now()}`));
        const requesterName = user.name || 'User';
        const photoUrl = req.file ? `/uploads/tickets/${req.file.filename}` : null;
        const [result] = await masterPool.query(
            `INSERT INTO complaints
             (complaint_number, requester_user_id, requester_type, requester_hrms_id, requester_name,
              requester_identifier, requester_phone, category_id, sub_category_id, college_id, college_name,
              block_no, floor_no, room_no, title, description, photo_url, status,
              assignments, comments, status_history)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '[]', '[]', '[]')`,
            [
                createTicketNumber(),
                requester?.id || null,
                requesterType,
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
                photoUrl
            ]
        );

        let row = await getComplaintRow(result.insertId);
        try {
            const [employees] = await masterPool.query(
                `SELECT id, assigned_categories FROM users
                 WHERE is_ticket_employee = 1 AND is_active = 1 AND role IN ('staff', 'manager')`
            );
            const assignedTo = employees.filter((employee) =>
                parseJson(employee.assigned_categories).map(Number).includes(Number(category_id))
            );
            if (assignedTo.length) {
                const assignments = assignedTo.map((employee) => ({
                    id: Date.now() + Number(employee.id),
                    assigned_to: Number(employee.id),
                    assigned_by: null,
                    notes: 'Auto-assigned based on category',
                    is_active: true,
                    assigned_at: new Date().toISOString()
                }));
                await saveComplaintJson(result.insertId, 'assignments', assignments);
                await appendStatus(row, 'approaching', null, 'Auto-assigned based on category');
                row = await getComplaintRow(result.insertId);
            }
        } catch (assignmentError) {
            console.error('Complaint auto-assignment failed:', assignmentError);
        }
        res.status(201).json({ success: true, message: 'Complaint created successfully', data: (await enrichComplaints([row]))[0] });
    } catch (error) {
        console.error('Error creating complaint:', error);
        res.status(500).json({ success: false, message: 'Error creating complaint', error: error.message });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const { status, category_id, assigned_to, student_id, requester_type, page = 1, limit = 50 } = req.query;
        const conditions = [];
        const params = [];
        if (status) { conditions.push('c.status = ?'); params.push(status); }
        if (category_id) { conditions.push('c.category_id = ?'); params.push(category_id); }
        if (student_id) {
            conditions.push('(c.requester_user_id = ? OR c.requester_identifier = ?)');
            params.push(student_id, student_id);
        }
        if (requester_type === 'student') conditions.push("c.requester_type = 'student'");
        if (requester_type === 'staff' || requester_type === 'faculty') conditions.push("c.requester_type = 'staff'");
        if (assigned_to) {
            conditions.push(`EXISTS (
                SELECT 1 FROM JSON_TABLE(c.assignments, '$[*]' COLUMNS (
                    assigned_user INT PATH '$.assigned_to',
                    assignment_active BOOLEAN PATH '$.is_active'
                )) a WHERE a.assigned_user = ? AND a.assignment_active = TRUE
            )`);
            params.push(Number(assigned_to));
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
        const offset = (pageNumber - 1) * pageSize;
        const [rows] = await masterPool.query(
            `SELECT c.*, cat.name AS category_name, sub.name AS sub_category_name
             FROM complaints c
             LEFT JOIN categories cat ON c.category_id = cat.id
             LEFT JOIN categories sub ON c.sub_category_id = sub.id
             ${where}
             ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        const [countRows] = await masterPool.query(`SELECT COUNT(*) AS total FROM complaints c ${where}`, params);
        res.json({
            success: true,
            data: await enrichComplaints(rows),
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
        const isRequester = user?.role === 'student'
            ? String(row.requester_identifier) === String(user.admission_number || user.admissionNumber)
            : (user?.hrmsId && row.requester_hrms_id === user.hrmsId) ||
              (user?.id && Number(row.requester_user_id) === Number(user.id));
        if (user?.role === 'student' || user?.ticketAccess === 'request' || (user?.is_hrms_session && !user?.id)) {
            if (!isRequester) return res.status(403).json({ success: false, message: 'Access denied. You can only view your own complaints.' });
        }
        const complaint = (await enrichComplaints([row]))[0];
        if (user?.ticketAccess === 'request' || user?.role === 'student' || (user?.is_hrms_session && !user?.id)) {
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
        res.json({ success: true, data: await enrichComplaints(rows) });
    } catch (error) {
        console.error('Error fetching requester complaints:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaints', error: error.message });
    }
};

exports.assignTicket = async (req, res) => {
    try {
        const row = await getComplaintRow(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Complaint not found' });
        const assignedTo = req.body.assigned_to;
        if (!Array.isArray(assignedTo)) return res.status(400).json({ success: false, message: 'assigned_to must be an array of user ids' });
        const ids = [...new Set(assignedTo.map(Number).filter(Number.isInteger))];
        let users = [];
        if (ids.length) {
            const [rows] = await masterPool.query('SELECT id FROM users WHERE id IN (?) AND is_active = 1', [ids]);
            users = rows.map((user) => Number(user.id));
            const missing = ids.filter((id) => !users.includes(id));
            if (missing.length) return res.status(400).json({ success: false, message: `Assigned user(s) not found: ${missing.join(', ')}` });
        }
        const assignments = users.map((id) => ({
            id: Date.now() + id,
            assigned_to: id,
            assigned_by: req.user?.id || null,
            notes: req.body.notes || null,
            is_active: true,
            assigned_at: new Date().toISOString()
        }));
        await saveComplaintJson(row.id, 'assignments', assignments);
        if (users.length && row.status === 'pending') await appendStatus(row, 'approaching', req.user?.id, 'Complaint assigned to staff');
        res.json({ success: true, message: users.length ? 'Complaint assigned successfully' : 'All assignees removed', data: { assignment_ids: assignments.map((item) => item.id) } });
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
        const user = req.user || req.admin || req.student;
        if (user?.ticketAccess === 'request' || user?.role === 'student' || (user?.is_hrms_session && !user?.id)) {
            const predicate = requesterPredicate(user);
            const ownsComplaint = predicate.value != null &&
                String(row[predicate.column]) === String(predicate.value);
            const isClosing = status === 'closed';
            const isReopening = status === 'pending' && (row.status === 'completed' || row.status === 'closed');
            if (!ownsComplaint || (!isClosing && !isReopening)) {
                return res.status(403).json({ success: false, message: 'Requesters may only close their complaints or re-raise completed ones' });
            }
        }
        await appendStatus(row, status, req.user?.id, notes);
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
        if (user?.ticketAccess === 'request' || user?.role === 'student' || user?.is_hrms_session) {
            const predicate = requesterPredicate(user);
            if (predicate.value == null || String(row[predicate.column]) !== String(predicate.value)) {
                return res.status(403).json({ success: false, message: 'You may only comment on your own complaints' });
            }
        }
        const comments = parseJson(row.comments);
        const comment = {
            id: Date.now(),
            ticket_id: row.id,
            user_id: user?.id || null,
            user_type: user?.role === 'student' ? 'student' : 'admin',
            comment_text: text,
            is_internal: user?.ticketAccess !== 'request' &&
                user?.role !== 'student' && !(user?.is_hrms_session && !user?.id) && Boolean(req.body.is_internal),
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
        const user = req.user || req.student;
        if (!user?.admission_number && !user?.admissionNumber) return res.status(401).json({ success: false, message: 'Student authentication required' });
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        const row = await getComplaintRow(req.params.id);
        const admissionNumber = user.admission_number || user.admissionNumber;
        if (!row || row.requester_identifier !== admissionNumber) return res.status(404).json({ success: false, message: 'Complaint not found or access denied' });
        if (row.status !== 'completed') return res.status(400).json({ success: false, message: 'Feedback can only be submitted for completed complaints' });
        if (parseJson(row.feedback, null)) return res.status(400).json({ success: false, message: 'Feedback already submitted for this complaint' });
        await saveComplaintJson(row.id, 'feedback', {
            student_id: row.requester_user_id,
            rating,
            feedback_text: req.body.feedback_text || null,
            created_at: new Date().toISOString()
        });
        const freshRow = { ...row, feedback: JSON.stringify({ rating }) };
        await appendStatus(freshRow, 'closed', user.id, 'Complaint closed automatically after student feedback');
        res.status(201).json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error submitting complaint feedback:', error);
        res.status(500).json({ success: false, message: 'Error submitting feedback', error: error.message });
    }
};

exports.getTicketStats = async (_req, res) => {
    try {
        const [statusRows] = await masterPool.query(
            'SELECT status, COUNT(*) AS count FROM complaints GROUP BY status'
        );
        const [categoryRows] = await masterPool.query(
            `SELECT cat.id AS category_id, cat.name AS category_name, COUNT(c.id) AS count
             FROM categories cat LEFT JOIN complaints c ON c.category_id = cat.id
             GROUP BY cat.id, cat.name ORDER BY count DESC`
        );
        const byStatus = statusRows.map((row) => ({ status: row.status, count: Number(row.count) }));
        const total = byStatus.reduce((sum, row) => sum + row.count, 0);
        res.json({ success: true, data: { total, by_status: byStatus, by_category: categoryRows } });
    } catch (error) {
        console.error('Error fetching complaint stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching complaint statistics', error: error.message });
    }
};
