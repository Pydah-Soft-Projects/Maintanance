import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    UserPlus,
    MessageSquare,
    Star,
    Clock,
    User,
    MapPin,
    Search
} from 'lucide-react';
import TicketStepper from './TicketStepper';
import { resolveTicketPhotoUrl } from '../../utils/ticketPhoto';
import './TicketDetailsModal.css';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approaching: 'bg-blue-100 text-blue-800 border-blue-200',
    resolving: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    closed: 'bg-gray-100 text-gray-800 border-gray-200'
};

const STATUS_LABELS = {
    pending: 'Pending',
    approaching: 'Approaching',
    resolving: 'Resolving',
    completed: 'Completed',
    closed: 'Closed'
};

const TicketDetailsModal = ({
    ticket,
    isLoading = false,
    onClose,
    initialAction = null,
    onAssign,
    onRemoveAssignment,
    statusForm,
    onStatusChange,
    onStatusSubmit,
    statusUpdating = false,
    assignForm,
    managersList = [],
    workersList = [],
    assignTab,
    onAssignTabChange,
    onAssignToggle,
    onAssignSubmit,
    assignSaving = false,
    commentForm,
    onCommentChange,
    onCommentSubmit,
    commentSaving = false
}) => {
    const [showAssignmentEditor, setShowAssignmentEditor] = useState(false);
    const [showResponseEditor, setShowResponseEditor] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState('');

    useEffect(() => {
        setShowAssignmentEditor(initialAction === 'assign');
        setShowResponseEditor(initialAction === 'response');
    }, [initialAction, ticket?.id]);

    useEffect(() => {
        setAssigneeSearch('');
    }, [ticket?.id, assignTab]);

    if (!ticket) return null;

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
                style={{ position: 'relative', zIndex: 10000, maxHeight: '85vh', width: '100%', maxWidth: '1000px', margin: '2rem', backgroundColor: 'white', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header Container */}
                <div className="ticket-details-header modal-header" style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 id="ticket-details-title" className="heading-font" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>Complaint details</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <p style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>REF: {ticket.ticket_number}</p>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db' }}></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#000000' }}>
                                <Clock size={12} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close complaint details" style={{ padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#000000', borderRadius: '1rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="ticket-details-body" style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', flex: 1 }}>
                    {isLoading ? (
                        <div style={{ padding: '3rem 0', textAlign: 'center', color: '#000000', fontWeight: 600 }}>
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
                            <div className="ticket-summary-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '1.5rem', border: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>Subject</label>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', lineHeight: 1.3 }}>{ticket.title}</h3>
                                </div>
                                <div className="ticket-summary-meta" style={{ display: 'flex', gap: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                                    <div className="ticket-summary-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>Category</label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                                            {ticket.category_name}
                                            {ticket.sub_category_name && <span style={{ color: '#000000', fontWeight: 500, fontSize: '0.875rem' }}> › {ticket.sub_category_name}</span>}
                                        </p>
                                    </div>
                                    <div className="ticket-summary-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>
                                            {ticket.requester_type === 'staff' ? 'Faculty / Staff' : 'Student'}
                                        </label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                                            {requesterName !== 'Unknown' ? requesterName : (ticket.admission_number ? `Staff #${ticket.admission_number}` : 'Unknown')}
                                        </p>
                                        {showAdmissionNumber && (
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#000000', fontFamily: 'monospace' }}>{ticket.admission_number}</p>
                                        )}
                                        {showStaffId && (
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#000000', fontFamily: 'monospace' }}>ID: {ticket.admission_number}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Physical Location Details */}
                            {(ticket.college_name || ticket.block_no || ticket.floor_no || ticket.room_no) && (
                                <div className="ticket-location-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', backgroundColor: '#eff6ff', borderRadius: '1.25rem', border: '1px solid #dbeafe' }}>
                                    <label style={{ fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 900, color: '#1d4ed8', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <MapPin size={14} color="#1d4ed8" /> Physical Location
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.875rem', color: '#1e3a8a', fontWeight: 700 }}>
                                        {ticket.college_name && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>College</span>
                                                <span>{ticket.college_name}</span>
                                            </div>
                                        )}
                                        {ticket.block_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Block</span>
                                                <span>{ticket.block_no}</span>
                                            </div>
                                        )}
                                        {ticket.floor_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Floor</span>
                                                <span>{ticket.floor_no}</span>
                                            </div>
                                        )}
                                        {ticket.room_no && (
                                            <div>
                                                <span style={{ fontSize: '0.6875rem', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Room No</span>
                                                <span>{ticket.room_no}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>Detailed Description</label>
                                <div className="ticket-description-card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                    <p style={{ color: '#000000', lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                                        {ticket.description || <span style={{ color: '#000000', fontStyle: 'italic' }}>No detailed description provided.</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Photo */}
                            {photoSrc && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>Attachment</label>
                                    <div style={{ borderRadius: '1.5rem', overflow: 'hidden', border: '4px solid #f9fafb', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                        <img src={photoSrc} alt="Ticket attachment" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', backgroundColor: '#f3f4f6' }} />
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <MessageSquare size={20} className="text-gray-400" />
                                        Discussion History
                                    </h3>
                                </div>

                                {ticket.comments && ticket.comments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {ticket.comments.map((comment) => (
                                            <div key={comment.id} style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: comment.is_internal ? '#fef3c7' : '#e0f2fe', color: comment.is_internal ? '#d97706' : '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem', flexShrink: 0 }}>
                                                    {comment.user_name.charAt(0)}
                                                </div>
                                                <div style={{ flex: 1, backgroundColor: comment.is_internal ? '#fffbeb' : '#f0f9ff', padding: '1rem', borderRadius: '0 1rem 1rem 1rem', border: `1px solid ${comment.is_internal ? '#fde68a' : '#e0f2fe'}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '0.875rem' }}>{comment.user_name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#000000' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p style={{ color: '#000000', fontSize: '0.875rem', lineHeight: 1.5 }}>{comment.comment_text}</p>
                                                    {comment.is_internal && <div style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: '#d97706', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Internal Note</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '1rem', border: '1px dashed #e5e7eb', color: '#000000', fontSize: '0.875rem' }}>
                                        No comments yet. Start a discussion below.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Actions & Meta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Current Status */}
                            <div className="ticket-action-card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'block' }}>Current Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span className={`status-badge ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`} style={{ padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                                        {STATUS_LABELS[ticket.status] || ticket.status}
                                    </span>
                                </div>
                                <div className="ticket-inline-status">
                                    <select
                                        aria-label="Update complaint status"
                                        value={statusForm.status || ticket.status}
                                        onChange={(event) => onStatusChange({ ...statusForm, status: event.target.value })}
                                    >
                                        {Object.entries(STATUS_LABELS)
                                            .filter(([status]) => status !== 'closed' || ticket.status === 'closed')
                                            .map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                                    </select>
                                    <button type="button" onClick={onStatusSubmit} disabled={statusUpdating}>
                                        {statusUpdating ? 'Updating...' : 'Update'}
                                    </button>
                                </div>
                            </div>

                            {/* Assigned Staff */}
                            <div className="ticket-action-card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#000000', letterSpacing: '0.05em' }}>Assigned Team</label>
                                    <button
                                        onClick={() => {
                                            if (!showAssignmentEditor) onAssign();
                                            setShowAssignmentEditor((visible) => !visible);
                                        }}
                                        style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', background: 'none', border: 'none' }}
                                    >
                                        <UserPlus size={14} /> {showAssignmentEditor ? 'Close' : 'Manage'}
                                    </button>
                                </div>
                                {ticket.assignments && ticket.assignments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {/* Managers List (Anyone who is NOT a worker) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Managers</label>
                                            {ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() !== 'worker')).length > 0 ? (
                                                ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() !== 'worker')).map((assignment) => (
                                                    <div key={assignment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f3e8ff', borderRadius: '0.75rem', border: '1px solid #e9d5ff' }}>
                                                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'white', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid #d8b4fe', flexShrink: 0 }}>
                                                            {(assignment.assigned_to_name || '?').charAt(0)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1f2937' }}>{assignment.assigned_to_name || 'Unknown user'}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 600, color: '#7e22ce', textTransform: 'uppercase' }}>
                                                                    {assignment.assigned_to_role === 'staff' ? 'Manager' : assignment.assigned_to_role}
                                                                </p>
                                                                <span style={{ fontSize: '0.625rem', color: '#000000' }}>
                                                                    {new Date(assignment.assigned_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {onRemoveAssignment && (
                                                            <button
                                                                onClick={() => handleRemoveAssignment(assignment)}
                                                                title="Remove assignee"
                                                                style={{ padding: '0.375rem', backgroundColor: 'white', color: '#dc2626', borderRadius: '50%', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                                className=""
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: '#000000', fontStyle: 'italic', paddingLeft: '0.5rem' }}>No manager assigned</p>
                                            )}
                                        </div>

                                        {/* Workers List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>Workers</label>
                                            {ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() === 'worker')).length > 0 ? (
                                                ticket.assignments.filter(a => (a.assigned_to_role?.toLowerCase() === 'worker')).map((assignment) => (
                                                    <div key={assignment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #dbeafe' }}>
                                                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'white', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', border: '1px solid #bfdbfe', flexShrink: 0 }}>
                                                            {(assignment.assigned_to_name || '?').charAt(0)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1f2937' }}>{assignment.assigned_to_name || 'Unknown user'}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>Worker</p>
                                                                <span style={{ fontSize: '0.625rem', color: '#000000' }}>
                                                                    {new Date(assignment.assigned_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {onRemoveAssignment && (
                                                            <button
                                                                onClick={() => handleRemoveAssignment(assignment)}
                                                                title="Remove assignee"
                                                                style={{ padding: '0.375rem', backgroundColor: 'white', color: '#dc2626', borderRadius: '50%', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                                className=""
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: '#000000', fontStyle: 'italic', paddingLeft: '0.5rem' }}>No workers assigned</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px dashed #e5e7eb' }}>
                                        <User size={20} className="text-gray-300 mx-auto mb-2" />
                                        <p style={{ fontSize: '0.75rem', color: '#000000' }}>No staff assigned</p>
                                    </div>
                                )}
                                {showAssignmentEditor && (
                                    <div className="ticket-inline-editor">
                                        <div className="ticket-inline-tabs">
                                            <button type="button" className={assignTab === 'managers' ? 'active' : ''} onClick={() => onAssignTabChange('managers')}>
                                                Managers ({managersList.length})
                                            </button>
                                            <button type="button" className={assignTab === 'workers' ? 'active' : ''} onClick={() => onAssignTabChange('workers')}>
                                                Workers ({workersList.length})
                                            </button>
                                        </div>
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
                                        <button type="button" className="ticket-inline-submit" onClick={onAssignSubmit} disabled={assignSaving}>
                                            {assignSaving ? 'Saving...' : assignForm.assigned_to.length ? 'Save assignments' : 'Unassign all'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Feedback (if exists) */}
                            {ticket.feedback && (
                                <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '1.5rem', border: '1px solid #bbf7d0' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#15803d', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Star size={12} fill="currentColor" /> Student Feedback
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 900, color: '#166534', lineHeight: 1 }}>{ticket.feedback.rating}</span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d', opacity: 0.7 }}>/ 5.0</span>
                                    </div>
                                    {ticket.feedback.feedback_text && (
                                        <p style={{ fontSize: '0.875rem', color: '#14532d', fontStyle: 'italic', fontWeight: 500 }}>"{ticket.feedback.feedback_text}"</p>
                                    )}
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
                                        style={{ width: '100%', padding: '1rem', backgroundColor: '#111827', color: 'white', borderRadius: '1rem', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer' }}
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
