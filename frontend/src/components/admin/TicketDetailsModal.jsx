import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
    X,
    UserPlus,
    MessageSquare,
    CheckCircle,
    XCircle,
    Clock,
    User,
    MapPin,
    Search,
    Lock as LockIcon
} from 'lucide-react';
import TicketStepper from './TicketStepper';
import { resolveTicketPhotoUrl } from '../../utils/ticketPhoto';
import { getFeedbackSatisfaction } from '../../utils/ticketFeedback';
import './TicketDetailsModal.css';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approaching: 'bg-blue-100 text-blue-800 border-blue-200',
    resolving: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    closed: 'bg-gray-100 text-gray-800 border-gray-200',
    rejected: 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_LABELS = {
    pending: 'Pending',
    approaching: 'Approaching',
    resolving: 'Resolving',
    completed: 'Completed',
    closed: 'Closed',
    rejected: 'Rejected'
};

const APPROVAL_ROLE_LABELS = {
    manager: 'Manager',
    worker: 'Worker',
    sub_admin: 'Sub-admin',
    super_admin: 'Superadmin'
};

const TicketDetailsModal = ({
    ticket,
    isLoading = false,
    onClose,
    initialAction = null,
    onAssign,
    onRemoveAssignment,
    canManageAssignments = true,
    statusForm,
    onStatusChange,
    onStatusSubmit,
    statusUpdating = false,
    assignForm,
    setAssignForm,
    managersList = [],
    workersList = [],
    hrmsEmployees = [],
    hrmsEmployeesLoading = false,
    hrmsEmployeesError = false,
    onHrmsSearchChange,
    assignTab,
    onAssignTabChange,
    onAssignToggle,
    onAssignSubmit,
    assignSaving = false,
    commentForm,
    onCommentChange,
    onCommentSubmit,
    commentSaving = false,
    approvalData = null,
    approvalLoading = false,
    onApprovalDecision,
    approvalSaving = false
}) => {
    const [showAssignmentEditor, setShowAssignmentEditor] = useState(initialAction === 'assign');
    const [showResponseEditor, setShowResponseEditor] = useState(initialAction === 'response');
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const feedbackSatisfaction = getFeedbackSatisfaction(ticket.feedback);
    const [externalName, setExternalName] = useState('');
    const [externalPhone, setExternalPhone] = useState('');

    if (!ticket) return null;

    const isApprovalPending = approvalData?.state === 'pending';
    const isRejected = ticket.status === 'rejected';
    const isClosed = ticket.status === 'closed';
    const isStatusLocked = isApprovalPending || isRejected || isClosed;
    const isAssignmentLocked = isApprovalPending || isRejected || isClosed || !canManageAssignments;

    const visibleAssignees = (assignTab === 'managers' ? managersList : workersList).filter((person) => {
        const query = assigneeSearch.trim().toLowerCase();
        return !query || [
            person.id,
            person.hrms_id,
            person.name,
            person.username,
            person.email,
            person.role,
            person.role_display_name
        ].some((value) => String(value || '').toLowerCase().includes(query));
    });
    const changeAssignTab = (tab) => {
        setAssigneeSearch('');
        onAssignTabChange(tab);
    };

    const handleRemoveAssignment = (assignment) => {
        if (!onRemoveAssignment) return;
        if (window.confirm(`Remove ${assignment.assigned_to_name || 'this person'} from the ticket?`)) {
            onRemoveAssignment(assignment.id);
        }
    };

    const requesterName =
        ticket.requester_name ||
        ticket.requester_display_name ||
        ticket.student_name ||
        ticket.staff_requester_name ||
        ticket.hrms_linked_name ||
        'Unknown';
    const photoSrc = resolveTicketPhotoUrl(ticket.photo_url);
    const showStaffId = ticket.requester_type === 'staff' &&
        ticket.admission_number &&
        !String(ticket.admission_number).startsWith('HRMS-');
    const showAdmissionNumber = ticket.requester_type !== 'staff' && ticket.admission_number;

    return createPortal(
        <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
            <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
            <div
                className="ticket-details-modal modal-content animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ticket-details-title"
                style={{ position: 'relative', zIndex: 10000, maxHeight: '85vh', width: '100%', maxWidth: '1000px', margin: '2rem', backgroundColor: 'var(--surface, #FFFFFF)', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header Container */}
                <div className="ticket-details-header modal-header" style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border, #E5E7EB)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 id="ticket-details-title" className="heading-font" style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary, #333333)' }}>Complaint details</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--primary, #1A2517)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>REF: {ticket.ticket_number}</p>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-strong, #CBD5E1)' }}></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-primary, #333333)' }}>
                                <Clock size={12} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close complaint details" style={{ padding: '0.75rem', backgroundColor: 'var(--background, #FAFAF5)', color: 'var(--text-primary, #333333)', borderRadius: '1rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="ticket-details-body" style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', flex: 1 }}>
                    {isLoading ? (
                        <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-primary, #333333)', fontWeight: 600 }}>
                            Loading ticket details...
                        </div>
                    ) : (
                    <>
                    {/* Status Stepper */}
                    <div className="ticket-progress-wrap">
                        <TicketStepper status={ticket.status} />
                    </div>

                    <div className="ticket-details-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }}>
                        {/* Left Column: Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* Title & Type */}
                            <div className="ticket-summary-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--background, #FAFAF5)', borderRadius: '1.5rem', border: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>Subject</label>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #333333)', lineHeight: 1.3 }}>{ticket.title}</h3>
                                </div>
                                <div className="ticket-summary-meta" style={{ display: 'flex', gap: '2rem', borderTop: '1px solid var(--border, #E5E7EB)', paddingTop: '1.5rem' }}>
                                    <div className="ticket-summary-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>Category</label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #333333)' }}>
                                            {ticket.category_name}
                                            {ticket.sub_category_name && <span style={{ color: 'var(--text-primary, #333333)', fontWeight: 500, fontSize: '0.875rem' }}> › {ticket.sub_category_name}</span>}
                                        </p>
                                    </div>
                                    <div className="ticket-summary-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>
                                            {ticket.requester_type === 'staff' ? 'Faculty / Staff' : 'Student'}
                                        </label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #333333)' }}>
                                            {requesterName !== 'Unknown' ? requesterName : (ticket.admission_number ? `Staff #${ticket.admission_number}` : 'Unknown')}
                                        </p>
                                        {showAdmissionNumber && (
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #333333)', fontFamily: 'monospace' }}>{ticket.admission_number}</p>
                                        )}
                                        {showStaffId && (
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #333333)', fontFamily: 'monospace' }}>ID: {ticket.admission_number}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Physical Location Details */}
                            {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
                                <div className="ticket-location-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', backgroundColor: 'var(--primary-light, #E8EEE4)', borderRadius: '1.25rem', border: '1px solid var(--primary-light, #E8EEE4)' }}>
                                    <label style={{ fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--primary, #1A2517)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <MapPin size={14} color="var(--primary, #1A2517)" /> Physical Location
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--primary-hover, #11180F)', fontWeight: 700 }}>
                                        {ticket.college_name && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--primary, #1A2517)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>College</span>
                                                <span>{ticket.college_name}</span>
                                            </div>
                                        )}
                                        {ticket.block_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--primary, #1A2517)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Block</span>
                                                <span>{ticket.block_no}</span>
                                            </div>
                                        )}
                                        {ticket.floor_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--primary, #1A2517)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Floor</span>
                                                <span>{ticket.floor_no}</span>
                                            </div>
                                        )}
                                        {ticket.room_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--primary, #1A2517)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Room No</span>
                                                <span>{ticket.room_no}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>Detailed Description</label>
                                <div className="ticket-description-card" style={{ padding: '1.5rem', backgroundColor: 'var(--surface, #FFFFFF)', borderRadius: '1.5rem', border: '1px solid var(--border, #E5E7EB)', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                    <p style={{ color: 'var(--text-primary, #333333)', lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                                        {ticket.description || <span style={{ color: 'var(--text-primary, #333333)', fontStyle: 'italic' }}>No detailed description provided.</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Photo */}
                            {photoSrc && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>Attachment</label>
                                    <div style={{ borderRadius: '1.5rem', overflow: 'hidden', border: '4px solid var(--background, #FAFAF5)', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                        <img src={photoSrc} alt="Ticket attachment" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', backgroundColor: 'var(--background, #FAFAF5)' }} />
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            <div style={{ borderTop: '1px solid var(--border, #E5E7EB)', paddingTop: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary, #333333)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <MessageSquare size={20} className="text-gray-400" />
                                        Discussion History
                                    </h3>
                                </div>

                                {ticket.comments && ticket.comments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {ticket.comments.map((comment) => (
                                            <div key={comment.id} style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: comment.is_internal ? 'var(--warning-light, #FEFCE8)' : 'var(--primary-light, #E8EEE4)', color: comment.is_internal ? 'var(--warning, #A16207)' : 'var(--primary, #1A2517)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem', flexShrink: 0 }}>
                                                    {comment.user_name.charAt(0)}
                                                </div>
                                                <div style={{ flex: 1, backgroundColor: comment.is_internal ? 'var(--warning-light, #FEFCE8)' : 'var(--primary-light, #E8EEE4)', padding: '1rem', borderRadius: '0 1rem 1rem 1rem', border: `1px solid ${comment.is_internal ? 'var(--warning-light, #FEFCE8)' : 'var(--primary-light, #E8EEE4)'}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--text-primary, #333333)', fontSize: '0.875rem' }}>{comment.user_name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary, #333333)' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p style={{ color: 'var(--text-primary, #333333)', fontSize: '0.875rem', lineHeight: 1.5 }}>{comment.comment_text}</p>
                                                    {comment.is_internal && <div style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--warning, #A16207)', backgroundColor: 'var(--warning-light, #FEFCE8)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Internal Note</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--background, #FAFAF5)', borderRadius: '1rem', border: '1px dashed var(--border, #E5E7EB)', color: 'var(--text-primary, #333333)', fontSize: '0.875rem' }}>
                                        No comments yet. Start a discussion below.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Actions & Meta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Current Status */}
                            <div className="ticket-action-card" style={{ padding: '1.5rem', backgroundColor: 'var(--surface, #FFFFFF)', borderRadius: '1.5rem', border: '1px solid var(--border, #E5E7EB)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'block' }}>Current Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span className={`status-badge ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`} style={{ padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                                        {STATUS_LABELS[ticket.status] || ticket.status}
                                    </span>
                                </div>
                                {!isClosed ? (
                                    <div className="ticket-inline-status">
                                        <select
                                            aria-label="Update complaint status"
                                            value={statusForm.status || ticket.status}
                                            onChange={(event) => onStatusChange({ ...statusForm, status: event.target.value })}
                                            disabled={isStatusLocked}
                                        >
                                            {Object.entries(STATUS_LABELS)
                                                .filter(([status]) => status !== 'rejected' && status !== 'closed')
                                                .map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                                        </select>
                                        <button type="button" onClick={onStatusSubmit} disabled={statusUpdating || isStatusLocked}>
                                            {statusUpdating ? 'Updating...' : 'Update'}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.75rem', color: '#475569', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem', color: '#1E293B' }}>
                                            <LockIcon size={14} className="text-slate-500" /> Status Locked
                                        </div>
                                        This complaint is closed. Status cannot be modified by maintenance users. It can only reopen if the requester submits unsatisfactory feedback.
                                    </div>
                                )}
                                {isApprovalPending && (
                                    <p className="ticket-inline-help">Status changes are locked until the approval flow finishes.</p>
                                )}
                                {isRejected && (
                                    <p className="ticket-inline-help">Rejected complaints are terminal and cannot be reopened.</p>
                                )}
                            </div>

                            {approvalLoading && (
                                <div className="ticket-action-card text-sm text-slate-500">Loading approval stages...</div>
                            )}
                            {approvalData && (
                                <div className="ticket-action-card ticket-approval-card">
                                    <div className="ticket-approval-heading">
                                        <div>
                                            <label className="ticket-inline-label">Approval flow</label>
                                            <p className="ticket-approval-state">
                                                {approvalData.state === 'pending'
                                                    ? `Stage ${approvalData.current_stage_order} of ${approvalData.steps.length}`
                                                    : approvalData.state === 'approved'
                                                        ? 'All stages approved'
                                                        : approvalData.state === 'rejected'
                                                            ? 'Rejected'
                                                            : 'Cancelled'}
                                            </p>
                                        </div>
                                        {approvalData.current_stage && (
                                            <span className="ticket-approval-group">
                                                {APPROVAL_ROLE_LABELS[approvalData.current_stage.member_type] ||
                                                    approvalData.current_stage.member_type}
                                            </span>
                                        )}
                                    </div>
                                    <ol className="ticket-approval-steps">
                                        {approvalData.steps.map((step) => (
                                            <li key={step.id} className={`ticket-approval-step is-${step.state}`}>
                                                <span className="ticket-approval-step-number">{step.stage_order}</span>
                                                <span className="ticket-approval-step-info">
                                                    <strong>{step.stage_name}</strong>
                                                    <small>
                                                        {APPROVAL_ROLE_LABELS[step.member_type] || step.member_type} · {step.state}
                                                    </small>
                                                    {step.decision_by_name && <small>By {step.decision_by_name}</small>}
                                                    {step.decision_notes && <small className="ticket-approval-notes">{step.decision_notes}</small>}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                    {approvalData.state === 'pending' && approvalData.can_act && (
                                        <div className="ticket-approval-actions">
                                            <label className="ticket-inline-label" htmlFor="ticket-rejection-reason">Decision note</label>
                                            <textarea
                                                id="ticket-rejection-reason"
                                                value={rejectionReason}
                                                onChange={(event) => setRejectionReason(event.target.value)}
                                                placeholder="A reason is required to reject"
                                                rows={3}
                                            />
                                            <div>
                                                <button
                                                    type="button"
                                                    className="ticket-approval-approve"
                                                    onClick={() => onApprovalDecision({ decision: 'approved', notes: rejectionReason.trim() })}
                                                    disabled={approvalSaving}
                                                >
                                                    {approvalSaving ? 'Submitting...' : 'Approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ticket-approval-reject"
                                                    onClick={() => onApprovalDecision({
                                                        decision: 'rejected',
                                                        notes: rejectionReason.trim()
                                                    })}
                                                    disabled={approvalSaving}
                                                >
                                                    Reject complaint
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {approvalData.state === 'pending' && !approvalData.can_act && (
                                        <p className="ticket-inline-help">Waiting for an assigned member of this stage to decide.</p>
                                    )}
                                </div>
                            )}

                            {/* Assigned Staff */}
                            <div className="ticket-action-card" style={{ padding: '1.5rem', backgroundColor: 'var(--surface, #FFFFFF)', borderRadius: '1.5rem', border: '1px solid var(--border, #E5E7EB)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: 'var(--text-primary, #333333)', letterSpacing: '0.05em' }}>Assigned Team</label>
                                    {canManageAssignments && (
                                        <button
                                            disabled={isAssignmentLocked}
                                            onClick={() => {
                                                if (!showAssignmentEditor) onAssign();
                                                setShowAssignmentEditor((visible) => !visible);
                                            }}
                                            style={{ color: isAssignmentLocked ? 'var(--text-muted, #777777)' : 'var(--primary, #1A2517)', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: isAssignmentLocked ? 'not-allowed' : 'pointer', background: 'none', border: 'none' }}
                                        >
                                            <UserPlus size={14} /> {showAssignmentEditor ? 'Close' : 'Manage'}
                                        </button>
                                    )}
                                </div>
                                {ticket.assignments && ticket.assignments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {/* Managers List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-primary, #333333)', textTransform: 'uppercase' }}>Managers</label>
                                            {ticket.assignments.filter(a => a.assigned_to_role?.toLowerCase() === 'manager').length > 0 ? (
                                                ticket.assignments.filter(a => a.assigned_to_role?.toLowerCase() === 'manager').map((assignment) => (
                                                    <div key={assignment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--primary-light, #E8EEE4)', borderRadius: '0.75rem', border: '1px solid var(--primary-light, #E8EEE4)' }}>
                                                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--surface, #FFFFFF)', color: 'var(--accent, #A3B18A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid var(--primary-light, #E8EEE4)', flexShrink: 0 }}>
                                                            {(assignment.assigned_to_name || '?').charAt(0)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary, #333333)' }}>{assignment.assigned_to_name || 'Unknown user'}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--accent, #A3B18A)', textTransform: 'uppercase' }}>
                                                                    {assignment.assigned_to_role}
                                                                </p>
                                                                <span style={{ fontSize: '0.625rem', color: 'var(--text-primary, #333333)' }}>
                                                                    {new Date(assignment.assigned_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            {assignment.assigned_to_phone && (
                                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #555555)' }}>{assignment.assigned_to_phone}</p>
                                                            )}
                                                        </div>
                                                        {onRemoveAssignment && !isAssignmentLocked && (
                                                            <button
                                                                onClick={() => handleRemoveAssignment(assignment)}
                                                                title="Remove assignee"
                                                                style={{ padding: '0.375rem', backgroundColor: 'var(--surface, #FFFFFF)', color: 'var(--danger, #B91C1C)', borderRadius: '50%', border: '1px solid var(--danger-light, #FEF2F2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                                className=""
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-primary, #333333)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>No manager assigned</p>
                                            )}
                                        </div>

                                        {/* Workers List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-primary, #333333)', textTransform: 'uppercase' }}>Workers</label>
                                            {ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() === 'worker')).length > 0 ? (
                                                ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() === 'worker')).map((assignment) => (
                                                    <div key={assignment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--primary-light, #E8EEE4)', borderRadius: '0.75rem', border: '1px solid var(--primary-light, #E8EEE4)' }}>
                                                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--surface, #FFFFFF)', color: 'var(--primary, #1A2517)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid var(--primary-light, #E8EEE4)', flexShrink: 0 }}>
                                                            {(assignment.assigned_to_name || '?').charAt(0)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary, #333333)' }}>{assignment.assigned_to_name || 'Unknown user'}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--primary, #1A2517)', textTransform: 'uppercase' }}>
                                                                    {assignment.assignment_type === 'hrms'
                                                                        ? 'HRMS employee'
                                                                        : assignment.assignment_type === 'external'
                                                                            ? 'External worker'
                                                                            : 'Worker'}
                                                                </p>
                                                                <span style={{ fontSize: '0.625rem', color: 'var(--text-primary, #333333)' }}>
                                                                    {new Date(assignment.assigned_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            {assignment.assigned_to_phone && (
                                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #555555)' }}>{assignment.assigned_to_phone}</p>
                                                            )}
                                                        </div>
                                                        {onRemoveAssignment && !isAssignmentLocked && (
                                                            <button
                                                                onClick={() => handleRemoveAssignment(assignment)}
                                                                title="Remove assignee"
                                                                style={{ padding: '0.375rem', backgroundColor: 'var(--surface, #FFFFFF)', color: 'var(--danger, #B91C1C)', borderRadius: '50%', border: '1px solid var(--danger-light, #FEF2F2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                                className=""
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-primary, #333333)', fontStyle: 'italic', paddingLeft: '0.5rem' }}>No workers assigned</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: 'var(--background, #FAFAF5)', borderRadius: '0.75rem', border: '1px dashed var(--border, #E5E7EB)' }}>
                                        <User size={20} className="text-gray-300 mx-auto mb-2" />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-primary, #333333)' }}>No staff assigned</p>
                                    </div>
                                )}
                                {canManageAssignments && showAssignmentEditor && !isAssignmentLocked && (
                                    <div className="ticket-inline-editor">
                                        <div className="ticket-inline-tabs">
                                            <button type="button" className={assignTab === 'managers' ? 'active' : ''} onClick={() => changeAssignTab('managers')}>
                                                Managers ({managersList.length})
                                            </button>
                                            <button type="button" className={assignTab === 'workers' ? 'active' : ''} onClick={() => changeAssignTab('workers')}>
                                                Workers ({workersList.length})
                                            </button>
                                            <button type="button" className={assignTab === 'hrms' ? 'active' : ''} onClick={() => changeAssignTab('hrms')}>
                                                HRMS employees
                                            </button>
                                            <button type="button" className={assignTab === 'external' ? 'active' : ''} onClick={() => changeAssignTab('external')}>
                                                External worker
                                            </button>
                                        </div>
                                        {assignTab === 'hrms' ? (
                                            <>
                                                <label className="ticket-inline-search">
                                                    <Search size={15} aria-hidden="true" />
                                                    <input
                                                        type="search"
                                                        value={assigneeSearch}
                                                        onChange={(event) => {
                                                            setAssigneeSearch(event.target.value);
                                                            onHrmsSearchChange(event.target.value);
                                                        }}
                                                        placeholder="Search HRMS by name, employee number, or phone"
                                                        aria-label="Search HRMS employees"
                                                    />
                                                </label>
                                                {hrmsEmployeesError && <p className="ticket-inline-empty">HRMS employee search is unavailable.</p>}
                                                {hrmsEmployeesLoading && <p className="ticket-inline-empty">Searching HRMS...</p>}
                                                <div className="ticket-inline-assignee-list">
                                                    {hrmsEmployees.map((employee) => {
                                                        const selected = (assignForm.hrms_assignees || []).some((item) =>
                                                            String(item.hrms_id) === String(employee.id)
                                                        );
                                                        return (
                                                            <label key={employee.id} className="ticket-inline-assignee">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected}
                                                                    onChange={() => {
                                                                        const current = assignForm.hrms_assignees || [];
                                                                        const next = selected
                                                                            ? current.filter((item) => String(item.hrms_id) !== String(employee.id))
                                                                            : [...current, {
                                                                                hrms_id: employee.id,
                                                                                employee_no: employee.emp_no,
                                                                                name: employee.name,
                                                                                phone: employee.phone
                                                                            }];
                                                                        setAssignForm({ ...assignForm, hrms_assignees: next });
                                                                    }}
                                                                />
                                                                <span className="ticket-inline-assignee-info">
                                                                    <strong>{employee.name}</strong>
                                                                    <small>{employee.emp_no || 'HRMS employee'}{employee.phone ? ` · ${employee.phone}` : ''}</small>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                    {!hrmsEmployeesLoading && !hrmsEmployeesError && hrmsEmployees.length === 0 && (
                                                        <p className="ticket-inline-empty">
                                                            {assigneeSearch.trim().length < 2
                                                                ? 'Enter at least 2 characters to search the HRMS directory.'
                                                                : 'No matching HRMS employees found.'}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        ) : assignTab === 'external' ? (
                                            <div className="space-y-3">
                                                <p className="ticket-inline-empty">For workers who are not listed in HRMS, enter their name and phone number.</p>
                                                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                                    Worker name
                                                    <input value={externalName} onChange={(event) => setExternalName(event.target.value)} maxLength={150} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                                </label>
                                                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                                    Phone number
                                                    <input type="tel" value={externalPhone} onChange={(event) => setExternalPhone(event.target.value)} maxLength={20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                                </label>
                                                <button
                                                    type="button"
                                                    className="ticket-inline-submit"
                                                    onClick={() => {
                                                        const name = externalName.trim();
                                                        const phone = externalPhone.trim();
                                                        const digits = phone.replace(/\D/g, '');
                                                        if (!name || name.length > 150 || digits.length < 7 || digits.length > 15 || !/^[+0-9().\-\s]+$/.test(phone)) {
                                                            return toast.error('Enter the worker name and a valid phone number.');
                                                        }
                                                        setAssignForm({
                                                            ...assignForm,
                                                            external_assignees: [...(assignForm.external_assignees || []), { name, phone }]
                                                        });
                                                        setExternalName('');
                                                        setExternalPhone('');
                                                    }}
                                                >
                                                    Add external worker
                                                </button>
                                                {(assignForm.external_assignees || []).map((person, index) => (
                                                    <div key={`${person.phone}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                                        <span>{person.name} · {person.phone}</span>
                                                        <button type="button" onClick={() => setAssignForm({
                                                            ...assignForm,
                                                            external_assignees: assignForm.external_assignees.filter((_, itemIndex) => itemIndex !== index)
                                                        })} className="text-red-600" aria-label={`Remove ${person.name}`}>Remove</button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                <label className="ticket-inline-search">
                                                    <Search size={15} aria-hidden="true" />
                                                    <input
                                                        type="search"
                                                        value={assigneeSearch}
                                                        onChange={(event) => setAssigneeSearch(event.target.value)}
                                                        placeholder={`Search ${assignTab} by name, ID, or role`}
                                                        aria-label={`Search ${assignTab}`}
                                                    />
                                                </label>
                                                <div className="ticket-inline-assignee-list">
                                                    {visibleAssignees.map((person) => {
                                                        const personId = person.rbac_user_id || person.id;
                                                        const checked = assignForm.assigned_to.includes(personId);
                                                        const assignedCategories = Array.isArray(person.assigned_categories)
                                                            ? person.assigned_categories.map(String)
                                                            : [];
                                                        const assignedSubcategories = Array.isArray(person.assigned_subcategories)
                                                            ? person.assigned_subcategories.map(String)
                                                            : [];
                                                        const hasScope = assignedCategories.length > 0 || assignedSubcategories.length > 0;
                                                        const matchesSubcategory = ticket.sub_category_id != null &&
                                                            assignedSubcategories.includes(String(ticket.sub_category_id));
                                                        const matchesCategory = ticket.category_id != null &&
                                                            assignedCategories.includes(String(ticket.category_id));
                                                        const scopeLabel = matchesSubcategory
                                                            ? 'Sub-category match'
                                                            : matchesCategory
                                                                ? 'Category match'
                                                                : hasScope
                                                                    ? 'Other category'
                                                                    : 'General scope';
                                                        return (
                                                            <label
                                                                key={person.id}
                                                                className={`ticket-inline-assignee ${matchesSubcategory || matchesCategory ? 'is-scope-match' : ''}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => onAssignToggle(personId)}
                                                                />
                                                                <span className="ticket-inline-assignee-info">
                                                                    <strong>{person.name}</strong>
                                                                    <small>{person.role_display_name || person.role || person.username}</small>
                                                                    <small className={`ticket-inline-scope ${matchesSubcategory || matchesCategory ? 'is-match' : ''}`}>
                                                                        {scopeLabel}
                                                                    </small>
                                                                </span>
                                                                <small className="ticket-inline-workload">
                                                                    {person.active_tickets_count || 0} active
                                                                </small>
                                                            </label>
                                                        );
                                                    })}
                                                    {visibleAssignees.length === 0 && (
                                                        <p className="ticket-inline-empty">
                                                            {assigneeSearch.trim() ? `No ${assignTab} match your search.` : `No ${assignTab} found.`}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        <button type="button" className="ticket-inline-submit" onClick={onAssignSubmit} disabled={assignSaving}>
                                            {assignSaving ? 'Saving...' : (
                                                (assignForm.assigned_to.length || assignForm.hrms_assignees?.length || assignForm.external_assignees?.length)
                                                    ? 'Save assignments'
                                                    : 'Unassign all'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Feedback (if exists) */}
                            {ticket.feedback && (
                                <div style={{
                                    padding: '1.5rem',
                                    backgroundColor: feedbackSatisfaction === false ? 'var(--danger-light, #FEF2F2)' : 'var(--success-light, #F0FDF4)',
                                    borderRadius: '1.5rem',
                                    border: `1px solid ${feedbackSatisfaction === false ? 'var(--danger-light, #FEF2F2)' : 'var(--success-light, #F0FDF4)'}`
                                }}>
                                    <label style={{
                                        fontSize: '0.625rem',
                                        textTransform: 'uppercase',
                                        fontWeight: 900,
                                        color: feedbackSatisfaction === false ? 'var(--danger, #B91C1C)' : 'var(--success, #15803D)',
                                        letterSpacing: '0.05em',
                                        marginBottom: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem'
                                    }}>
                                        <MessageSquare size={12} /> Student Feedback
                                    </label>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: feedbackSatisfaction === false ? 'var(--danger, #B91C1C)' : 'var(--success, #15803D)',
                                        fontWeight: 700
                                    }}>
                                        {feedbackSatisfaction === false ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                        <span>{feedbackSatisfaction === false ? 'Not satisfied' : 'Satisfied'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Actions Panel */}
                            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                                {showResponseEditor ? (
                                    <div className="ticket-inline-editor">
                                        <label className="ticket-inline-label" htmlFor="ticket-response">Add Response</label>
                                        <textarea
                                            id="ticket-response"
                                            value={commentForm.comment_text}
                                            onChange={(event) => onCommentChange({ ...commentForm, comment_text: event.target.value })}
                                            placeholder="Write a response..."
                                            rows={4}
                                        />
                                        <label className="ticket-inline-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={commentForm.is_internal}
                                                onChange={(event) => onCommentChange({ ...commentForm, is_internal: event.target.checked })}
                                            />
                                            Internal note (visible only to staff)
                                        </label>
                                        <div className="ticket-inline-actions">
                                            <button type="button" className="ticket-inline-cancel" onClick={() => setShowResponseEditor(false)}>Cancel</button>
                                            <button type="button" className="ticket-inline-submit" onClick={onCommentSubmit} disabled={commentSaving}>
                                                {commentSaving ? 'Sending...' : 'Send response'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowResponseEditor(true)}
                                        style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--primary, #1A2517)', color: 'white', borderRadius: '1rem', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer' }}
                                    >
                                        <MessageSquare size={18} />
                                        Add Response
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TicketDetailsModal;
