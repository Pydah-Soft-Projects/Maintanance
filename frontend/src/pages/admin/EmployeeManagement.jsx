import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    UserPlus,
    Trash2,
    Edit,
    Search,
    TrendingUp,
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import EmployeeModal from '../../components/admin/EmployeeModal';
import EmployeeHistoryModal from '../../components/admin/EmployeeHistoryModal';
import '../../styles/admin-pages.css';

const EmployeeManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [viewingHistoryUser, setViewingHistoryUser] = useState(null);

    const queryClient = useQueryClient();

    // Fetch users (from maintenance_db.users)
    const { data: employeesData, isLoading } = useQuery({
        queryKey: ['ticket-employees'],
        queryFn: async () => {
            const response = await api.get('/employees');
            return response.data?.data || [];
        }
    });

    // Fetch available roles
    const { data: rolesData } = useQuery({
        queryKey: ['ticket-roles'],
        queryFn: async () => {
            const response = await api.get('/roles');
            return response.data?.data || [];
        }
    });

    // Mutations
    const mutationConfig = {
        onSuccess: () => {
            toast.success(editingUser ? 'User updated successfully' : 'User registered from HRMS successfully');
            closeModal();
            queryClient.invalidateQueries(['ticket-employees']);
            queryClient.invalidateQueries(['rbac-users']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Operation failed')
    };

    const createMutation = useMutation({
        mutationFn: (data) => api.post('/employees', data),
        ...mutationConfig
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
        ...mutationConfig
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/employees/${id}`),
        onSuccess: () => {
            toast.success('User removed from ticket system');
            queryClient.invalidateQueries(['ticket-employees']);
        },
        onError: (err) => toast.error('Failed to remove user')
    });

    // Filtering across all users
    const employees = employeesData || [];
    const filteredEmployees = employees.filter(employee => {
        const name = employee.name?.toLowerCase() || '';
        const email = employee.email?.toLowerCase() || '';
        const role = (employee.role_display_name || employee.role || '').toLowerCase();
        const username = employee.username?.toLowerCase() || '';
        const phone = employee.phone?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return name.includes(search) || email.includes(search) || role.includes(search) || username.includes(search) || phone.includes(search);
    });

    const handleModalSubmit = (type, payload) => {
        if (type === 'create') {
            createMutation.mutate({
                hrms_employee_id: payload.hrms_employee_id,
                hrms_employee_no: payload.hrms_employee_no,
                name: payload.name,
                role: payload.role,
                custom_role_id: payload.custom_role_id,
                assigned_categories: payload.assigned_categories,
                assigned_subcategories: payload.assigned_subcategories
            });
        } else if (type === 'update') {
            updateMutation.mutate({
                id: payload.id,
                data: {
                    name: payload.name,
                    role: payload.role,
                    custom_role_id: payload.custom_role_id,
                    assigned_categories: payload.assigned_categories,
                    assigned_subcategories: payload.assigned_subcategories
                }
            });
        }
    };

    const openModal = (user = null) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    if (isLoading) {
        return (
            <div className="admin-page-container animate-pulse">
                <div className="mb-6">
                    <div className="h-10 bg-gray-200 rounded w-full max-w-md"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white rounded-lg p-6 border h-40 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gray-200"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                                    <div>
                                        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <div className="w-8 h-8 rounded bg-gray-200"></div>
                                    <div className="w-8 h-8 rounded bg-gray-200"></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-48"></div>
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-container">
            <div className="user-management-actions">
                <span className="user-management-count">
                    {filteredEmployees.length} {filteredEmployees.length === 1 ? 'user' : 'users'} provisioned from HRMS
                </span>
                <button onClick={() => openModal()} className="btn-primary py-2 px-3 text-xs shrink-0 flex items-center gap-1.5" type="button">
                        <UserPlus size={16} />
                        <span>Create User</span>
                </button>
            </div>

            <div className="card-base user-management-table-card" style={{ padding: 0 }}>
                {/* Search Filter */}
                <div className="admin-filters-section">
                    <div className="input-group-wrapper" style={{ maxWidth: '100%' }}>
                        <Search className="input-icon" size={16} />
                        <input
                            className="input-with-icon"
                            placeholder="Search users by name, employee ID, email, or role..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="user-table-scroll">
                    <table className="admin-table user-management-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Employee ID</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Role</th>
                                <th className="user-table-actions-heading">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.length ? filteredEmployees.map((employee) => (
                                <tr key={employee.id}>
                                    <td>
                                        <span className="user-table-name">{employee.name || 'Unnamed user'}</span>
                                    </td>
                                    <td>{employee.username || '—'}</td>
                                    <td className="user-table-email">{employee.email || '—'}</td>
                                    <td>{employee.phone || '—'}</td>
                                    <td>{employee.role_display_name || employee.role || '—'}</td>
                                    <td>
                                        <div className="user-table-actions">
                                            <button
                                                type="button"
                                                onClick={() => setViewingHistoryUser(employee)}
                                                className="user-table-action history"
                                                title="View history"
                                                aria-label={`View history for ${employee.name}`}
                                            >
                                                <TrendingUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openModal(employee)}
                                                className="user-table-action edit"
                                                title="Edit user"
                                                aria-label={`Edit ${employee.name}`}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm(`Remove user "${employee.name}" from ticket system?`)) {
                                                        deleteMutation.mutate(employee.id);
                                                    }
                                                }}
                                                className="user-table-action delete"
                                                title="Remove user"
                                                aria-label={`Remove ${employee.name}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6">
                                        <div className="empty-state">
                                            <div className="empty-state-icon"><Search size={32} /></div>
                                            <p className="empty-state-text">No users found matching your search.</p>
                                            <button onClick={() => setSearchTerm('')} className="empty-state-action" type="button">
                                                Clear search
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeModal
                isOpen={showModal}
                onClose={closeModal}
                user={editingUser}
                availableRoles={rolesData || []}
                onSubmit={handleModalSubmit}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
            />

            <EmployeeHistoryModal
                isOpen={!!viewingHistoryUser}
                onClose={() => setViewingHistoryUser(null)}
                employee={viewingHistoryUser}
            />
        </div>
    );
};

export default EmployeeManagement;
