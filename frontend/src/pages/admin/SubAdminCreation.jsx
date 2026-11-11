import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Search, Shield, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';
import {
    TICKET_MODULES,
    TICKET_MODULE_PERMISSIONS,
    TICKET_MODULE_LABELS,
    createDefaultTicketPermissions
} from '../../constants/ticketRbac';
import '../../styles/admin-pages.css';

const getPermissions = (permissions) => {
    if (!permissions) return createDefaultTicketPermissions();
    if (typeof permissions === 'string') {
        try {
            return JSON.parse(permissions);
        } catch (error) {
            console.error('Failed to parse sub-admin permissions:', error);
            toast.error('Saved permissions could not be read; reset them before saving.');
            return createDefaultTicketPermissions();
        }
    }
    return permissions;
};

const SubAdminCreation = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [employeeNo, setEmployeeNo] = useState('');
    const [localName, setLocalName] = useState('');
    const [hrmsSearch, setHrmsSearch] = useState('');
    const [formPermissions, setFormPermissions] = useState(createDefaultTicketPermissions());
    const queryClient = useQueryClient();

    const {
        data: users = [],
        isLoading: usersLoading,
        isError: usersError
    } = useQuery({
        queryKey: ['rbac-users'],
        queryFn: async () => {
            const response = await api.get('/rbac/users');
            return response.data?.data || [];
        }
    });

    const {
        data: directory = [],
        isLoading: directoryLoading,
        isError: directoryError
    } = useQuery({
        queryKey: ['hrms-directory'],
        queryFn: async () => {
            const response = await api.get('/rbac/users/hrms-directory');
            return response.data?.data || [];
        }
    });

    const refreshUserData = () => {
        queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
        queryClient.invalidateQueries({ queryKey: ['hrms-directory'] });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (editingAdmin) {
                return api.put(`/rbac/users/${editingAdmin.id}/access`, {
                    name: localName,
                    role: 'sub_admin',
                    permissions: formPermissions
                });
            }

            const employee = directory.find((item) => item.employee_no === employeeNo);
            if (!employee) throw new Error('Select an active HRMS employee');

            const linkResponse = await api.post('/rbac/users/hrms-link', {
                employee_no: employee.employee_no,
                local_name: localName,
                ...(employee.rbac_user_id ? { rbac_user_id: employee.rbac_user_id } : {})
            });
            const userId = linkResponse.data?.data?.id;
            if (!userId) throw new Error('HRMS user link returned no ticket-app user ID');

            return api.put(`/rbac/users/${userId}/access`, {
                role: 'sub_admin',
                permissions: formPermissions
            });
        },
        onSuccess: () => {
            toast.success(editingAdmin ? 'Sub-admin access updated' : 'HRMS user granted sub-admin access');
            setShowModal(false);
            refreshUserData();
        },
        onError: (error) => toast.error(error.response?.data?.message || error.message || 'Failed to save access')
    });

    const removeAccessMutation = useMutation({
        mutationFn: (id) => api.put(`/rbac/users/${id}/access`, { role: 'worker', permissions: {} }),
        onSuccess: () => {
            toast.success('Sub-admin access removed');
            refreshUserData();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Failed to remove sub-admin access')
    });

    const subAdmins = useMemo(() => users.filter((user) =>
        user.role === 'sub_admin' &&
        `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm]);

    const openModal = (admin = null) => {
        setEditingAdmin(admin);
        setEmployeeNo('');
        setLocalName(admin?.name || '');
        setHrmsSearch('');
        setFormPermissions(admin
            ? getPermissions(admin.permissions)
            : createDefaultTicketPermissions());
        setShowModal(true);
    };

    const togglePermission = (module, action) => {
        setFormPermissions((previous) => ({
            ...previous,
            [module]: {
                ...previous[module],
                [action]: !previous[module]?.[action]
            }
        }));
    };

    if (usersLoading || directoryLoading) {
        return <div className="card-base p-6 text-sm text-slate-500">Loading users and HRMS directory...</div>;
    }
    if (usersError || directoryError) {
        return (
            <div className="card-base p-6 text-sm text-red-700">
                User records or the HRMS directory could not be loaded. Check the connection and try again.
            </div>
        );
    }

    const availableEmployees = directory.filter((employee) =>
        employee.role !== 'sub_admin' &&
        employee.role !== 'admin' &&
        employee.role !== 'super_admin'
    );

    return (
        <div className="admin-page-container">
            <div className="card-base p-0">
                <div className="admin-filters-section flex flex-wrap items-center justify-between gap-4">
                    <div className="input-group-wrapper" style={{ maxWidth: '400px', flex: 1 }}>
                        <Search className="input-icon" size={18} />
                        <input
                            className="input-with-icon"
                            placeholder="Search sub-admins..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <button type="button" onClick={() => openModal()} className="btn-primary inline-flex items-center gap-2">
                        <Shield size={17} /> Assign Sub-admin Access
                    </button>
                </div>

                <div className="divide-y divide-slate-100">
                    {subAdmins.length ? subAdmins.map((admin) => (
                        <div key={admin.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="font-semibold text-slate-900">{admin.name}</h3>
                                <p className="text-sm text-slate-500">
                                    {admin.email} {admin.hrms_id ? '· HRMS linked' : '· Not linked to HRMS'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => openModal(admin)}
                                    className="btn-secondary inline-flex items-center gap-2"
                                >
                                    <Edit size={15} /> Edit Access
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Remove sub-admin access? The user account will remain active.')) {
                                            removeAccessMutation.mutate(admin.id);
                                        }
                                    }}
                                    className="btn-secondary inline-flex items-center gap-2 text-red-600"
                                    disabled={removeAccessMutation.isPending}
                                >
                                    <ShieldOff size={15} /> Remove Access
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-10 text-center text-sm text-slate-500">No sub-admins found.</div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-lg">
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">{editingAdmin ? 'Edit Sub-admin Access' : 'Assign Sub-admin Access'}</h2>
                                <p className="text-sm text-slate-500">
                                    {editingAdmin
                                        ? `${editingAdmin.name} · account managed by HRMS`
                                        : 'Select an HRMS employee. Create the account in HRMS first.'}
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="modal-close-btn" aria-label="Close">
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            {!editingAdmin && (
                                <div className="mb-6">
                                    <label className="form-label" htmlFor="hrms-sub-admin-search">Search HRMS employees</label>
                                    <input
                                        id="hrms-sub-admin-search"
                                        className="form-input mb-3"
                                        value={hrmsSearch}
                                        onChange={(event) => setHrmsSearch(event.target.value)}
                                        placeholder="Search by employee number or name"
                                    />
                                    <select
                                        id="hrms-sub-admin"
                                        className="form-input"
                                        value={employeeNo}
                                        onChange={(event) => {
                                            const selectedNo = event.target.value;
                                            setEmployeeNo(selectedNo);
                                            setLocalName(directory.find((employee) => employee.employee_no === selectedNo)?.name || '');
                                        }}
                                    >
                                        <option value="">Select an HRMS employee</option>
                                        {availableEmployees.filter((employee) =>
                                            `${employee.employee_no} ${employee.name}`.toLowerCase().includes(hrmsSearch.toLowerCase())
                                        ).map((employee) => (
                                            <option key={employee.id} value={employee.employee_no}>
                                                {employee.employee_no} — {employee.name}{employee.rbac_user_id ? ' (linked)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {employeeNo && (
                                        <label className="mt-4 block">
                                            <span className="form-label">Ticket-app display name</span>
                                            <input
                                                className="form-input"
                                                value={localName}
                                                onChange={(event) => setLocalName(event.target.value)}
                                                maxLength={255}
                                                required
                                            />
                                        </label>
                                    )}
                                </div>
                            )}
                            {editingAdmin && (
                                <div className="mb-6">
                                    <label className="form-label" htmlFor="ticket-sub-admin-name">Ticket-app display name</label>
                                    <input
                                        id="ticket-sub-admin-name"
                                        className="form-input"
                                        value={localName}
                                        onChange={(event) => setLocalName(event.target.value)}
                                        maxLength={255}
                                        required
                                    />
                                </div>
                            )}
                            <h3 className="mb-4 border-b pb-2 font-bold text-slate-900">Module Permissions</h3>
                            <div className="grid max-h-96 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2">
                                {Object.values(TICKET_MODULES).map((module) => (
                                    <div key={module} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 font-semibold text-slate-700">
                                            {TICKET_MODULE_LABELS[module] || module}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(TICKET_MODULE_PERMISSIONS[module].labels).map(([action, label]) => (
                                                <label key={action} className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-white p-2 text-xs">
                                                    <span>{label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(formPermissions[module]?.[action])}
                                                        onChange={() => togglePermission(module, action)}
                                                        aria-label={`${TICKET_MODULE_LABELS[module] || module} ${action}`}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer flex justify-end gap-3">
                            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending || !localName.trim() || (!editingAdmin && !employeeNo)}
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Save Access'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubAdminCreation;
