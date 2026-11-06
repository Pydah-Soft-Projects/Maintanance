import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Users } from 'lucide-react';
import EmployeeManagement from './EmployeeManagement';
import RoleManagement from './RoleManagement';
import useAuthStore from '../../store/authStore';

const UserManagement = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const canViewUsers = hasPermission('employee_management', 'users');
    const canViewRoles = hasPermission('employee_management', 'roles');
    if (!canViewUsers && !canViewRoles) {
        return <Navigate to="/unauthorized" replace />;
    }
    const activeTab = searchParams.get('tab') === 'roles' && canViewRoles
        ? 'roles'
        : canViewUsers ? 'users' : 'roles';

    const setActiveTab = (tab) => {
        setSearchParams(tab === 'roles' ? { tab: 'roles' } : {});
    };

    return (
        <div className="admin-page-container">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Provision users from HRMS and manage ticket roles. Authentication is verified via HRMS.
                </p>
            </div>

            <div className="mb-6 flex gap-2 border-b border-slate-200">
                {canViewUsers && <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                        activeTab === 'users'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                    aria-current={activeTab === 'users' ? 'page' : undefined}
                >
                    <span className="flex items-center gap-2"><Users size={17} /> Users</span>
                </button>}
                {canViewRoles && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('roles')}
                        className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'roles'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={activeTab === 'roles' ? 'page' : undefined}
                    >
                        <span className="flex items-center gap-2"><ShieldCheck size={17} /> Roles</span>
                    </button>
                )}
            </div>

            {activeTab === 'roles' ? (
                <RoleManagement />
            ) : (
                <EmployeeManagement />
            )}
        </div>
    );
};

export default UserManagement;
