import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';

const HrmsUserMapping = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState({});
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

    const linkMutation = useMutation({
        mutationFn: ({ userId, employeeNo }) => api.post('/rbac/users/hrms-link', {
            rbac_user_id: userId,
            employee_no: employeeNo
        }),
        onSuccess: () => {
            toast.success('User linked to HRMS');
            queryClient.invalidateQueries({ queryKey: ['rbac-users'] });
            queryClient.invalidateQueries({ queryKey: ['hrms-directory'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Failed to link HRMS user')
    });

    const unlinkedUsers = users.filter((user) => {
        const search = searchTerm.toLowerCase();
        return !user.hrms_id && (
            user.name?.toLowerCase().includes(search) ||
            user.email?.toLowerCase().includes(search) ||
            user.username?.toLowerCase().includes(search)
        );
    });

    if (usersLoading || directoryLoading) {
        return <div className="card-base p-6 text-sm text-slate-500">Loading users and HRMS directory...</div>;
    }

    if (directoryError || usersError) {
        return (
            <div className="card-base p-6 text-sm text-red-700">
                User records or the HRMS directory could not be loaded. Check the connection and try again.
            </div>
        );
    }

    return (
        <div className="card-base p-0">
            <div className="admin-filters-section">
                <div className="input-group-wrapper" style={{ maxWidth: '480px' }}>
                    <Search className="input-icon" size={18} />
                    <input
                        className="input-with-icon"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search unlinked ticket-app users..."
                    />
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {unlinkedUsers.length ? unlinkedUsers.map((user) => {
                    const availableEmployees = directory.filter(
                        (employee) => !employee.rbac_user_id || Number(employee.rbac_user_id) === Number(user.id)
                    );

                    return (
                        <div key={user.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{user.name}</p>
                                <p className="truncate text-sm text-slate-500">
                                    {user.email || user.username} · {user.role}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <select
                                    className="form-input min-w-64"
                                    value={selectedEmployee[user.id] || ''}
                                    onChange={(event) => setSelectedEmployee((previous) => ({
                                        ...previous,
                                        [user.id]: event.target.value
                                    }))}
                                    aria-label={`HRMS employee for ${user.name}`}
                                >
                                    <option value="">Select HRMS employee number</option>
                                    {availableEmployees.map((employee) => (
                                        <option key={employee.id} value={employee.employee_no}>
                                            {employee.employee_no} — {employee.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="btn-primary inline-flex items-center justify-center gap-2"
                                    disabled={!selectedEmployee[user.id] || linkMutation.isPending}
                                    onClick={() => linkMutation.mutate({
                                        userId: user.id,
                                        employeeNo: selectedEmployee[user.id]
                                    })}
                                >
                                    <Link2 size={16} /> Link to HRMS
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="p-8 text-center text-sm text-slate-500">
                        {directory.length === 0
                            ? 'No active HRMS employees are available.'
                            : 'All ticket-app users are linked to HRMS.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HrmsUserMapping;
