import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Ticket,
    Search,
    UserPlus,
    Edit,
    Eye,
    CheckCircle,
    Clock,
    XCircle,
    Filter,
    GraduationCap,
    Briefcase,
    LayoutGrid
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import TicketDetailsModal from '../../components/admin/TicketDetailsModal';
import { TaskManagementSkeleton } from '../../components/SkeletonLoader';
import useAuthStore from '../../store/authStore';
import '../../styles/admin-pages.css';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approaching: 'bg-gray-100 text-gray-700 border-gray-200',
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

const COMPLAINT_SOURCES = [
    { id: 'ALL', label: 'All Sources', icon: LayoutGrid, permission: null, requesterType: null },
    { id: 'SDMS', label: 'SDMS · Student', icon: GraduationCap, permission: null, requesterType: 'student' },
    { id: 'HMS', label: 'HMS · Hostel', icon: Ticket, permission: null, requesterType: 'student' },
    { id: 'HRMS', label: 'HRMS · Faculty', icon: Briefcase, permission: null, requesterType: 'staff' }
];

const getRequesterLabel = (ticket) =>
    ticket.requester_name ||
    ticket.requester_display_name ||
    ticket.student_name ||
    ticket.staff_requester_name ||
    ticket.hrms_linked_name ||
    (ticket.requester_type === 'staff' ? ticket.admission_number : null) ||
    'Unknown';

const TaskManagement = () => {
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const authUser = useAuthStore((state) => state.user);
    const isWorker = authUser?.role === 'worker' ||
        authUser?.ticketRole === 'worker' ||
        authUser?.is_worker === true;
    const canViewEmployeeDirectory = hasPermission('employee_management', 'read');
    const [selectedReferenceSite, setReferenceSite] = useState('ALL');
    const [selectedTab, setActiveTab] = useState(isWorker ? 'assigned' : 'all');
    const allowedSources = COMPLAINT_SOURCES;
    const allowedTabs = ['all', 'pending', 'assigned', 'resolved'];
    const approvalTab = 'pending';
    const referenceSite = allowedSources.some(({ id }) => id === selectedReferenceSite)
        ? selectedReferenceSite
        : 'ALL';
    const selectedSource = COMPLAINT_SOURCES.find(({ id }) => id === referenceSite);
    const activeTab = isWorker
        ? 'assigned'
        : allowedTabs.includes(selectedTab) ? selectedTab : 'all';
    const [filters, setFilters] = useState({
        category_id: '',
        assigned_to: '',
        search: ''
    });
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketInitialAction, setTicketInitialAction] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [assignTab, setAssignTab] = useState('managers');
    const [hrmsAssigneeSearch, setHrmsAssigneeSearch] = useState('');

    // Forms state
    const [assignForm, setAssignForm] = useState({
        assigned_to: [],
        hrms_assignees: [],
        external_assignees: [],
        notes: ''
    });
    const [statusForm, setStatusForm] = useState({ status: '', notes: '' });
    const [commentForm, setCommentForm] = useState({ comment_text: '', is_internal: false });

    const queryClient = useQueryClient();

    // Map tabs to status array
    const getStatusesForTab = (tab) => {
        switch (tab) {
            case 'all': return ['pending', 'approaching', 'resolving', 'completed', 'closed', 'rejected'];
            case 'pending': return ['pending'];
            case 'assigned': return ['approaching', 'resolving'];
            case 'resolved': return ['completed', 'closed', 'rejected'];
            default: return [];
        }
    };

    // Queries
    const { data: sourceCounts } = useQuery({
        queryKey: ['ticket-source-counts', allowedSources.map(({ id }) => id)],
        queryFn: async () => {
            const results = await Promise.all(allowedSources.map(async (source) => {
                const params = { page: 1, limit: 1 };
                if (source.id !== 'ALL') {
                    params.reference_site = source.id;
                    params.requester_type = source.requesterType;
                }
                const response = await api.get('/tickets', { params });
                return [source.id, response.data?.pagination?.total ?? 0];
            }));
            return Object.fromEntries(results);
        },
        enabled: !isWorker && allowedSources.length > 0
    });

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['tickets', isWorker ? 'assigned-to-me' : referenceSite, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isWorker && referenceSite && referenceSite !== 'ALL') {
                if (selectedSource?.requesterType) {
                    params.append('requester_type', selectedSource.requesterType);
                }
                params.append('reference_site', referenceSite);
            }
            params.append('page', '1');
            params.append('limit', '1000');
            const response = await api.get(`/tickets?${params.toString()}`);
            return response.data;
        },
        staleTime: 0,
        refetchOnMount: 'always',
        enabled: Boolean(activeTab && (isWorker || referenceSite))
    });

    const { data: ticketDetails, isLoading: ticketDetailsLoading } = useQuery({
        queryKey: ['ticket', selectedTicket?.id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${selectedTicket.id}`);
            return response.data?.data;
        },
        enabled: !!selectedTicket?.id
    });

    const { data: ticketApproval, isLoading: ticketApprovalLoading } = useQuery({
        queryKey: ['ticket-approvals', selectedTicket?.id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${selectedTicket.id}/approvals`);
            return response.data?.data;
        },
        enabled: !!selectedTicket?.id
    });

    const { data: categoriesData } = useQuery({
        queryKey: ['complaint-categories'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories');
            return response.data?.data || [];
        }
    });

    const { data: employeesData } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const response = await api.get('/employees');
            return response.data?.data || [];
        },
        enabled: canViewEmployeeDirectory
    });

    const {
        data: hrmsAssignees = [],
        isLoading: hrmsAssigneesLoading,
        isError: hrmsAssigneesError
    } = useQuery({
        queryKey: ['hrms-assignees', hrmsAssigneeSearch],
        queryFn: async () => {
            const response = await api.get('/tickets/hrms-assignees', {
                params: { search: hrmsAssigneeSearch.trim() }
            });
            return response.data?.data || [];
        },
        enabled: assignTab === 'hrms' && hrmsAssigneeSearch.trim().length >= 2
    });

    // Mutations
    const assignMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/assign`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            setShowAssignModal(false);
            setTicketInitialAction(null);
            setAssignForm({ assigned_to: [], hrms_assignees: [], external_assignees: [], notes: '' });
            queryClient.invalidateQueries(['tickets']);
            queryClient.invalidateQueries(['ticket-source-counts']);
            if (selectedTicket) queryClient.invalidateQueries(['ticket', selectedTicket.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign ticket')
    });

    const removeAssignmentMutation = useMutation({
        mutationFn: async ({ ticketId, assignmentId }) => {
            const response = await api.delete(`/tickets/${ticketId}/assign/${assignmentId}`);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Assignee removed');
            queryClient.invalidateQueries(['tickets']);
            queryClient.invalidateQueries(['ticket-source-counts']);
            if (selectedTicket) queryClient.invalidateQueries(['ticket', selectedTicket.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove assignee')
    });

    const statusMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.put(`/tickets/${ticketId}/status`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Status updated successfully');
            setShowStatusModal(false);
            setStatusForm({ status: '', notes: '' });
            queryClient.invalidateQueries(['tickets']);
            queryClient.invalidateQueries(['ticket-source-counts']);
            if (selectedTicket) queryClient.invalidateQueries(['ticket', selectedTicket.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status')
    });

    const commentMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/comments`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Comment added successfully');
            setShowCommentModal(false);
            setCommentForm({ comment_text: '', is_internal: false });
            queryClient.invalidateQueries(['ticket', selectedTicket?.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to add comment')
    });

    const approvalMutation = useMutation({
        mutationFn: async ({ ticketId, decision, notes }) => {
            const response = await api.post(`/tickets/${ticketId}/approval-decision`, { decision, notes });
            return response.data;
        },
        onSuccess: (_, variables) => {
            toast.success(variables.decision === 'approved' ? 'Approval recorded' : 'Complaint rejected');
            queryClient.invalidateQueries(['tickets']);
            queryClient.invalidateQueries(['ticket', variables.ticketId]);
            queryClient.invalidateQueries(['ticket-approvals', variables.ticketId]);
            queryClient.invalidateQueries(['ticket-source-counts']);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to submit approval decision')
    });

    // Filter Logic
    const allTickets = ticketsData?.data || [];
    const sourceTickets = allTickets;

    const getTabCount = (tab) => {
        if (isWorker || tab === 'all') return sourceTickets.length;
        const statuses = getStatusesForTab(tab);
        return sourceTickets.filter((ticket) =>
            statuses.includes(ticket.status) ||
            (tab === approvalTab && ticket.approval?.state === 'pending' && ticket.approval.can_act)
        ).length;
    };

    const filteredTickets = sourceTickets.filter(ticket => {
        const statuses = getStatusesForTab(activeTab);
        const matchesStatus = isWorker || activeTab === 'all' || statuses.includes(ticket.status) ||
            (activeTab === approvalTab && ticket.approval?.state === 'pending' && ticket.approval.can_act);
        const matchesCategory = filters.category_id
            ? Number(ticket.category_id) === Number(filters.category_id)
            : true;
        const matchesSearch = filters.search ?
            ticket.title.toLowerCase().includes(filters.search.toLowerCase()) ||
            (ticket.complaint_number && String(ticket.complaint_number).toLowerCase().includes(filters.search.toLowerCase())) ||
            (ticket.ticket_number && String(ticket.ticket_number).toLowerCase().includes(filters.search.toLowerCase())) ||
            String(ticket.id).includes(filters.search.toLowerCase()) ||
            getRequesterLabel(ticket).toLowerCase().includes(filters.search.toLowerCase())
            : true;

        return matchesStatus && matchesCategory && matchesSearch;
    });

    const currentUserId = authUser?.rbac_user_id || authUser?.id;
    const currentEmployee = employeesData?.find((employee) =>
        String(employee.rbac_user_id || employee.id) === String(currentUserId)
    );
    const currentCategories = Array.isArray(currentEmployee?.assigned_categories)
        ? currentEmployee.assigned_categories.map(String)
        : [];
    const currentSubcategories = Array.isArray(currentEmployee?.assigned_subcategories)
        ? currentEmployee.assigned_subcategories.map(String)
        : [];
    const scopePriority = (employee, ticket) => {
        const categories = Array.isArray(employee.assigned_categories)
            ? employee.assigned_categories.map(String)
            : [];
        const subcategories = Array.isArray(employee.assigned_subcategories)
            ? employee.assigned_subcategories.map(String)
            : [];
        if (ticket.sub_category_id != null && subcategories.includes(String(ticket.sub_category_id))) return 0;
        if (ticket.category_id != null && categories.includes(String(ticket.category_id))) return 1;
        return categories.length || subcategories.length ? 3 : 2;
    };
    const orderAssignees = (people) => [...people].sort((first, second) =>
        scopePriority(first, ticketDetails || selectedTicket || {}) -
            scopePriority(second, ticketDetails || selectedTicket || {}) ||
        Number(first.active_tickets_count || 0) - Number(second.active_tickets_count || 0) ||
        String(first.name || '').localeCompare(String(second.name || ''))
    );
    const managersList = orderAssignees(
        employeesData?.filter((employee) => employee.role === 'manager') || []
    );
    const workersList = orderAssignees(
        employeesData?.filter((employee) => employee.legacy_role === 'worker' || employee.role === 'worker') || []
    );
    const prioritizedTickets = [...filteredTickets].sort((first, second) => {
        const getPriority = (ticket) => {
            if (ticket.approval?.state === 'pending' && ticket.approval.can_act) return 0;
            const assignedToCurrentUser = ticket.assignments?.some((assignment) =>
                currentUserId != null &&
                String(assignment.assigned_to) === String(currentUserId) &&
                assignment.is_active !== false
            );
            if (assignedToCurrentUser) return 1;
            if (ticket.sub_category_id != null && currentSubcategories.includes(String(ticket.sub_category_id))) return 2;
            if (ticket.category_id != null && currentCategories.includes(String(ticket.category_id))) return 3;
            return 4;
        };
        return getPriority(first) - getPriority(second);
    });

    // Handlers
    const handleAssign = () => {
        // An empty selection is allowed: it unassigns everyone from the ticket
        assignMutation.mutate({ ticketId: selectedTicket.id, data: assignForm });
    };

    const handleStatusUpdate = () => {
        if (selectedTicket?.status === 'closed') {
            return toast.error('Closed complaints cannot have their status changed');
        }
        const status = statusForm.status || selectedTicket.status;
        if (!status) return toast.error('Select a status');
        statusMutation.mutate({ ticketId: selectedTicket.id, data: { ...statusForm, status } });
    };

    const openTicketDetails = (ticket) => {
        setSelectedTicket(ticket);
        setTicketInitialAction(null);
        setStatusForm({ status: ticket.status, notes: '' });
        setHrmsAssigneeSearch('');
        const assignments = ticket.assignments || [];
        setAssignForm({
            assigned_to: assignments.map((assignment) => assignment.assigned_to).filter(Boolean),
            hrms_assignees: assignments.filter((assignment) => assignment.assignment_type === 'hrms').map((assignment) => ({
                hrms_id: assignment.assigned_to_hrms_id,
                employee_no: assignment.assigned_to_identifier,
                name: assignment.assigned_to_name,
                phone: assignment.assigned_to_phone
            })),
            external_assignees: assignments.filter((assignment) => assignment.assignment_type === 'external').map((assignment) => ({
                name: assignment.assigned_to_name,
                phone: assignment.assigned_to_phone
            })),
            notes: ''
        });
        setCommentForm({ comment_text: '', is_internal: false });
    };

    // Prepare inline action forms
    const openAssignmentEditor = (ticket) => {
        openTicketDetails(ticket);
        setAssignTab('managers');
        setHrmsAssigneeSearch('');
        setTicketInitialAction('assign');
    };

    const openStatusEditor = (ticket) => {
        openTicketDetails(ticket);
        setStatusForm({ status: ticket.status, notes: '' });
    };

    if (isLoading) {
        return <TaskManagementSkeleton />;
    }

    return (
        <div className="admin-page-container">
            <header className="page-header complaints-page-header">
                <div className="complaints-page-heading">
                    <h1 className="page-title">Complaints</h1>
                    <p className="page-subtitle">Review, assign, and track incoming complaints.</p>
                </div>
                <div className="admin-tabs-container complaints-status-tabs">
                    <div className="admin-tabs-list">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`admin-tab-btn ${activeTab === 'all' ? 'active-all' : ''}`}
                        >
                            <LayoutGrid size={16} /> All Complaints
                            <span className="admin-tab-count">{getTabCount('all')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('pending')}
                            className={`admin-tab-btn ${activeTab === 'pending' ? 'active-pending' : ''}`}
                            hidden={isWorker}
                        >
                            <Clock size={16} /> Pending
                            <span className="admin-tab-count">{getTabCount('pending')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('assigned')}
                            className={`admin-tab-btn ${activeTab === 'assigned' ? 'active-assigned' : ''}`}
                        >
                            <UserPlus size={16} /> {isWorker ? 'All Assigned' : 'Assigned / In Progress'}
                            <span className="admin-tab-count">{getTabCount('assigned')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('resolved')}
                            className={`admin-tab-btn ${activeTab === 'resolved' ? 'active-resolved' : ''}`}
                            hidden={isWorker}
                        >
                            <CheckCircle size={16} /> Resolved
                            <span className="admin-tab-count">{getTabCount('resolved')}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Complaints table and filters */}
            <div className="card-base complaints-table-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Filters Section - Pure CSS */}
                <div className="admin-filters-section">
                    <div className="admin-filters-grid complaints-filter-row">
                        <div className="input-group-wrapper">
                            <Search className="input-icon" size={16} />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search by ID or Title..."
                                className="input-with-icon"
                            />
                        </div>
                        <div className="input-group-wrapper">
                            <Filter className="input-icon" size={16} />
                            <select
                                value={filters.category_id}
                                onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                                className="input-with-icon"
                                style={{ appearance: 'none', cursor: 'pointer' }}
                            >
                                <option value="">All Categories</option>
                                {categoriesData?.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        {!isWorker && (
                            <div className="admin-audience-selector" role="tablist" aria-label="Filter complaints by source system">
                                {allowedSources.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={referenceSite === id}
                                    onClick={() => setReferenceSite(id)}
                                    className={`admin-audience-btn ${referenceSite === id ? 'active' : ''}`}
                                >
                                    {React.createElement(Icon, { size: 17 })}
                                    <span>{label}</span>
                                    <span className="admin-audience-count">
                                        {sourceCounts?.[id] ?? 0}
                                    </span>
                                </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Counter & Status Header */}
                <div style={{ padding: '0.625rem 1.25rem', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.8125rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                        Showing <strong style={{ color: '#0F172A', fontWeight: 700 }}>{prioritizedTickets.length}</strong> {prioritizedTickets.length === 1 ? 'complaint' : 'complaints'}
                        {filters.category_id || filters.search ? ` (filtered from ${sourceTickets.length} total)` : ''}
                    </span>
                    {(filters.category_id || filters.search) && (
                        <button
                            type="button"
                            onClick={() => setFilters({ category_id: '', assigned_to: '', search: '' })}
                            style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            Reset filters
                        </button>
                    )}
                </div>

                {/* Table Section - Pure CSS */}
                <div className="admin-table-scroll-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Ref #</th>
                                <th>Title</th>
                                <th>{!isWorker && referenceSite === 'HRMS' ? 'Faculty' : 'Requester'}</th>
                                <th>Reference Site</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.length > 0 ? (
                                prioritizedTickets.map((ticket) => {
                                    const assignedToCurrentUser = ticket.assignments?.some((assignment) =>
                                        currentUserId != null &&
                                        String(assignment.assigned_to) === String(currentUserId) &&
                                        assignment.is_active !== false
                                    );
                                    const matchesSubcategory = ticket.sub_category_id != null &&
                                        currentSubcategories.includes(String(ticket.sub_category_id));
                                    const matchesCategory = ticket.category_id != null &&
                                        currentCategories.includes(String(ticket.category_id));
                                    const hasScopeMatch = matchesSubcategory || matchesCategory;
                                    const canApprove = ticket.approval?.state === 'pending' && ticket.approval.can_act;
                                    return (
                                    <tr
                                        key={ticket.id}
                                        className={`admin-table-row-clickable ${canApprove ? 'ticket-priority-approval' : assignedToCurrentUser ? 'ticket-priority-assigned' : hasScopeMatch ? 'ticket-priority-scoped' : ''}`}
                                        onClick={() => openTicketDetails(ticket)}
                                    >
                                        <td>
                                            <span className="text-sm font-bold text-gray-900">{ticket.ticket_number}</span>
                                            <div className="text-xs text-gray-500 mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td>
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{ticket.title}</div>
                                            {(assignedToCurrentUser || hasScopeMatch) && (
                                                <span className={`ticket-priority-badge ${assignedToCurrentUser ? 'is-assigned' : ''}`}>
                                                    {assignedToCurrentUser
                                                        ? 'Assigned to you'
                                                        : matchesSubcategory
                                                            ? 'Your sub-category'
                                                            : 'Your category'}
                                                </span>
                                            )}
                                            {ticket.approval?.state === 'pending' && (
                                                <span className={`ticket-priority-badge ${canApprove ? 'is-approval' : ''}`}>
                                                    {canApprove
                                                        ? `Your approval · ${ticket.approval.current_stage_name}`
                                                        : `Approval · ${ticket.approval.current_stage_name}`}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="text-sm font-medium text-gray-900">{getRequesterLabel(ticket)}</div>
                                            {(isWorker || referenceSite !== 'HRMS') && ticket.admission_number && (
                                                <div className="text-xs text-gray-500 mt-0.5">{ticket.admission_number}</div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                                {ticket.reference_site || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">
                                                {ticket.category_name}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${STATUS_COLORS[ticket.status]}`}>
                                                {STATUS_LABELS[ticket.status]}
                                            </span>
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openTicketDetails(ticket)} className="p-2 text-gray-500 rounded-lg transition-colors border border-transparent" title="View Details">
                                                    <Eye size={18} />
                                                </button>
                                                {!isWorker && (
                                                    <button onClick={() => openAssignmentEditor(ticket)} disabled={ticket.approval?.state === 'pending'} className="p-2 text-green-600 rounded-lg border border-transparent disabled:cursor-not-allowed disabled:opacity-40" title={ticket.approval?.state === 'pending' ? 'Approval must finish before assignment' : 'Assign'}>
                                                        <UserPlus size={18} />
                                                    </button>
                                                )}
                                                <button onClick={() => openStatusEditor(ticket)} className="p-2 text-purple-600  rounded-lg transition-colors border border-transparent " title="Update Status">
                                                    <Edit size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" style={{ padding: '4rem 0', textAlign: 'center' }}>
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                                <Ticket size={32} className="text-gray-300" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">
                                                No {isWorker ? 'assigned complaints' : selectedSource?.label || 'complaints'} found
                                            </p>
                                            <p className="text-sm mt-1">
                                                {isWorker ? 'Complaints assigned to you will appear here.' : 'Try another source tab or adjust your filters'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {selectedTicket && (
                <TicketDetailsModal
                    key={`${selectedTicket.id}-${ticketInitialAction || 'view'}-${ticketApproval?.state || 'none'}`}
                    ticket={ticketDetails || selectedTicket}
                    isLoading={ticketDetailsLoading && !ticketDetails}
                    initialAction={ticketInitialAction}
                    canManageAssignments={!isWorker}
                    onClose={() => {
                        setSelectedTicket(null);
                        setTicketInitialAction(null);
                    }}
                    onAssign={() => openAssignmentEditor(ticketDetails || selectedTicket)}
                    onRemoveAssignment={(assignmentId) =>
                        removeAssignmentMutation.mutate({ ticketId: selectedTicket.id, assignmentId })
                    }
                    statusForm={statusForm}
                    onStatusChange={setStatusForm}
                    onStatusSubmit={handleStatusUpdate}
                    statusUpdating={statusMutation.isPending}
                    assignForm={assignForm}
                    setAssignForm={setAssignForm}
                    managersList={managersList}
                    workersList={workersList}
                    hrmsEmployees={hrmsAssignees}
                    hrmsEmployeesLoading={hrmsAssigneesLoading}
                    hrmsEmployeesError={hrmsAssigneesError}
                    onHrmsSearchChange={setHrmsAssigneeSearch}
                    assignTab={assignTab}
                    onAssignTabChange={(tab) => {
                        setAssignTab(tab);
                        setHrmsAssigneeSearch('');
                    }}
                    onAssignToggle={(userId) => {
                        const selected = assignForm.assigned_to.includes(userId);
                        setAssignForm({
                            ...assignForm,
                            assigned_to: selected
                                ? assignForm.assigned_to.filter((id) => id !== userId)
                                : [...assignForm.assigned_to, userId]
                        });
                    }}
                    onAssignSubmit={handleAssign}
                    assignSaving={assignMutation.isPending}
                    commentForm={commentForm}
                    onCommentChange={setCommentForm}
                    onCommentSubmit={() => {
                        if (!commentForm.comment_text.trim()) return toast.error('Please enter a response');
                        commentMutation.mutate({ ticketId: selectedTicket.id, data: commentForm });
                    }}
                    commentSaving={commentMutation.isPending}
                    approvalData={ticketApproval}
                    approvalLoading={ticketApprovalLoading}
                    approvalSaving={approvalMutation.isPending}
                    onApprovalDecision={({ decision, notes }) => {
                        if (decision === 'rejected' && !notes.trim()) {
                            return toast.error('Enter a reason before rejecting');
                        }
                        approvalMutation.mutate({
                            ticketId: selectedTicket.id,
                            decision,
                            notes
                        });
                    }}
                />
            )}

            {/* Assign Modal */}
            {showAssignModal && selectedTicket && (
                <div className="modal-overlay backdrop-blur-sm bg-gray-900/50">
                    <div className="modal-content animate-fade-in modal-md shadow-2xl rounded-2xl border border-gray-100 transform scale-100 transition-all">
                        <div className="modal-header border-b border-gray-100 p-5 bg-white rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Assign Ticket</h2>
                                <p className="text-sm text-gray-500 mt-1">Select personnel to handle this request</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} className="p-2  rounded-full transition-colors text-gray-400 ">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="modal-body p-6 bg-gray-50/50">
                            {/* Tabs */}
                            <div className="flex items-center p-1.5 bg-gray-200/60 rounded-xl mb-6 select-none relative z-10">
                                <button
                                    onClick={() => setAssignTab('managers')}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ease-out ${assignTab === 'managers'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-black/5 scale-[1.02]'
                                        : 'text-gray-500  '
                                        }`}
                                >
                                    <span>Managers</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${assignTab === 'managers' ? 'bg-primary/10 text-primary-dark' : 'bg-gray-300/50 text-gray-600'
                                        }`}>
                                        {managersList.length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setAssignTab('workers')}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ease-out ${assignTab === 'workers'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-black/5 scale-[1.02]'
                                        : 'text-gray-500  '
                                        }`}
                                >
                                    <span>Workers</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${assignTab === 'workers' ? 'bg-primary/10 text-primary-dark' : 'bg-gray-300/50 text-gray-600'
                                        }`}>
                                        {workersList.length}
                                    </span>
                                </button>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
                                {assignTab === 'managers' && (
                                    <div className="space-y-2 animate-fade-in">
                                        {managersList.length > 0 ? (
                                            managersList.map((user) => {
                                                const userId = user.rbac_user_id || user.id;
                                                return (
                                                    <label key={user.id} className={`group flex items-start p-3.5 rounded-xl cursor-pointer transition-all border-2 ${assignForm.assigned_to.includes(userId)
                                                        ? 'bg-blue-50 border-blue-500 shadow-sm'
                                                        : 'bg-white  border-transparent  shadow-sm'
                                                        }`}>
                                                        <div className="mt-1 relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={assignForm.assigned_to.includes(userId)}
                                                                onChange={() => {
                                                                    const newAssigned = assignForm.assigned_to.includes(userId)
                                                                        ? assignForm.assigned_to.filter(id => id !== userId)
                                                                        : [...assignForm.assigned_to, userId];
                                                                    setAssignForm({ ...assignForm, assigned_to: newAssigned });
                                                                }}
                                                                className="peer appearance-none w-5 h-5 rounded-md border-2 border-gray-300 checked:bg-blue-600 checked:border-blue-600 focus:ring-4 focus:ring-blue-600/20 transition-all cursor-pointer"
                                                            />
                                                            <CheckCircle className="w-3.5 h-3.5 text-white absolute top-[5px] left-[5px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-all scale-50 peer-checked:scale-100" strokeWidth={3} />
                                                        </div>

                                                        <div className="ml-4 flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`font-semibold text-sm ${assignForm.assigned_to.includes(userId) ? 'text-gray-900' : 'text-gray-700'}`}>
                                                                    {user.name}
                                                                </span>
                                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${user.active_tickets_count > 0
                                                                    ? 'bg-orange-100 text-orange-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.active_tickets_count > 0 ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                                                                    {user.active_tickets_count || 0} active
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center text-xs text-blue-700 font-medium">
                                                                    <span className="truncate">@{user.username}</span>
                                                                </div>
                                                                <div className="text-[10px] px-2 py-0.5 text-blue-800 bg-blue-100 rounded-lg">
                                                                    {user.role_display_name || user.role}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                )
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                    <UserPlus size={32} className="text-gray-300" strokeWidth={1.5} />
                                                </div>
                                                <p className="text-sm font-medium text-gray-500">No managers found</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {assignTab === 'workers' && (
                                    <div className="space-y-2 animate-fade-in">
                                        {workersList.length > 0 ? (
                                            workersList.map((user) => {
                                                const userId = user.rbac_user_id || user.id;
                                                return (
                                                    <label key={user.id} className={`group flex items-start p-3.5 rounded-xl cursor-pointer transition-all border-2 ${assignForm.assigned_to.includes(userId)
                                                        ? 'bg-blue-50 border-blue-500 shadow-sm'
                                                        : 'bg-white  border-transparent  shadow-sm'
                                                        }`}>
                                                        <div className="mt-1 relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={assignForm.assigned_to.includes(userId)}
                                                                onChange={() => {
                                                                    const newAssigned = assignForm.assigned_to.includes(userId)
                                                                        ? assignForm.assigned_to.filter(id => id !== userId)
                                                                        : [...assignForm.assigned_to, userId];
                                                                    setAssignForm({ ...assignForm, assigned_to: newAssigned });
                                                                }}
                                                                className="peer appearance-none w-5 h-5 rounded-md border-2 border-gray-300 checked:bg-blue-600 checked:border-blue-600 focus:ring-4 focus:ring-blue-600/20 transition-all cursor-pointer"
                                                            />
                                                            <CheckCircle className="w-3.5 h-3.5 text-white absolute top-[5px] left-[5px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-all scale-50 peer-checked:scale-100" strokeWidth={3} />
                                                        </div>

                                                        <div className="ml-4 flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`font-semibold text-sm ${assignForm.assigned_to.includes(userId) ? 'text-gray-900' : 'text-gray-700'}`}>
                                                                    {user.name}
                                                                </span>
                                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${user.active_tickets_count > 0
                                                                    ? 'bg-orange-100 text-orange-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.active_tickets_count > 0 ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                                                                    {user.active_tickets_count || 0} active
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center text-xs text-blue-700 font-medium">
                                                                    <span className="truncate">@{user.username}</span>
                                                                </div>
                                                                <div className="text-[10px] px-2 py-0.5 text-blue-800 bg-blue-100 rounded-lg">
                                                                    {user.role_display_name || user.role}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                )
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                    <UserPlus size={32} className="text-gray-300" strokeWidth={1.5} />
                                                </div>
                                                <p className="text-sm font-medium text-gray-500">No workers found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer p-5 border-t border-gray-100 bg-white rounded-b-2xl flex items-center justify-end gap-3">
                            <button onClick={() => setShowAssignModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700   transition-colors">Cancel</button>
                            <button onClick={handleAssign} disabled={assignMutation.isPending} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600  shadow-lg shadow-blue-600/30 disabled:opacity-70 disabled:shadow-none transition-all transform  active:scale-[0.98]">
                                {assignMutation.isPending
                                    ? 'Saving...'
                                    : assignForm.assigned_to.length === 0
                                        ? 'Unassign All'
                                        : 'Assign Selected'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {showStatusModal && selectedTicket && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-sm">
                        <div className="modal-header">
                            <h2 className="modal-title">Update Status</h2>
                            <button onClick={() => setShowStatusModal(false)} className="modal-close-btn"><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div>
                                <label className="form-label">New Status</label>
                                <select
                                    value={statusForm.status}
                                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                                    className="form-input cursor-pointer"
                                >
                                    <option value="">Select Status</option>
                                    {Object.entries(STATUS_LABELS)
                                        .filter(([k]) => k !== 'closed' && k !== 'rejected')
                                        .map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowStatusModal(false)} className="btn-secondary">Cancel</button>
                            <button onClick={handleStatusUpdate} disabled={statusMutation.isPending} className="btn-primary">
                                {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Comment Modal */}
            {showCommentModal && selectedTicket && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-md">
                        <div className="modal-header">
                            <h2 className="modal-title">Add Comment</h2>
                            <button onClick={() => setShowCommentModal(false)} className="modal-close-btn"><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="space-y-4">
                                <div>
                                    <label className="form-label">Comment</label>
                                    <textarea
                                        value={commentForm.comment_text}
                                        onChange={(e) => setCommentForm({ ...commentForm, comment_text: e.target.value })}
                                        className="form-input min-h-[100px]"
                                        placeholder="Type your comment here..."
                                    />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={commentForm.is_internal}
                                        onChange={(e) => setCommentForm({ ...commentForm, is_internal: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Internal Note (Visible only to staff)</span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCommentModal(false)} className="btn-secondary">Cancel</button>
                            <button
                                onClick={() => {
                                    if (!commentForm.comment_text.trim()) return toast.error('Please enter a comment');
                                    commentMutation.mutate({ ticketId: selectedTicket.id, data: commentForm });
                                }}
                                disabled={commentMutation.isPending}
                                className="btn-primary"
                            >
                                {commentMutation.isPending ? 'Adding...' : 'Add Comment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskManagement;
