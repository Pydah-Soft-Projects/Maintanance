import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { GitBranch, ShieldCheck, Users } from 'lucide-react';
import EmployeeManagement from './EmployeeManagement';
import RoleManagement from './RoleManagement';
import ApprovalWorkflowManagement from './ApprovalWorkflowManagement';
import useAuthStore from '../../store/authStore';

class ManagementTabBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error(`User Management ${this.props.tabName} tab failed to render:`, error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
                    This tab could not be displayed. Switch to another tab or reload the page.
                </div>
            );
        }
        return this.props.children;
    }
}

const UserManagement = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const user = useAuthStore((state) => state.user);
    const canViewUsers = hasPermission('employee_management', 'users');
    const canViewRoles = hasPermission('employee_management', 'roles');
    if (!canViewUsers && !canViewRoles) {
        return <Navigate to="/unauthorized" replace />;
    }
    const requestedTab = searchParams.get('tab');
    const activeTab = requestedTab === 'roles' && canViewRoles
        ? 'roles'
        : requestedTab === 'approvals' && canViewRoles
            ? 'approvals'
            : canViewUsers ? 'users' : canViewRoles ? 'roles' : null;

    const setActiveTab = (tab) => {
        if (tab === 'users' && !canViewUsers) return;
        if (tab !== 'users' && !canViewRoles) return;
        setSearchParams(tab === 'users' ? {} : { tab });
    };

    return (
        <div className="admin-page-container">
            <header className="page-header">
                <h1 className="page-title">User Management</h1>
                <p className="page-subtitle">
                    Provision users from HRMS and manage ticket roles. Authentication is verified via HRMS.
                </p>
            </header>

            <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200" role="tablist" aria-label="User management sections">
                {canViewUsers && <button
                    type="button"
                    role="tab"
                    onClick={() => setActiveTab('users')}
                    className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                        activeTab === 'users'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-500 '
                    }`}
                    aria-selected={activeTab === 'users'}
                >
                    <span className="flex items-center gap-2"><Users size={17} /> Users</span>
                </button>}
                {canViewRoles && (
                    <button
                        type="button"
                        role="tab"
                        onClick={() => setActiveTab('roles')}
                        className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'roles'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 '
                        }`}
                        aria-selected={activeTab === 'roles'}
                    >
                        <span className="flex items-center gap-2"><ShieldCheck size={17} /> Roles</span>
                    </button>
                )}
                {canViewRoles && (
                    <button
                        type="button"
                        role="tab"
                        onClick={() => setActiveTab('approvals')}
                        className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'approvals'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 '
                        }`}
                        aria-selected={activeTab === 'approvals'}
                    >
                        <span className="flex items-center gap-2"><GitBranch size={17} /> Approval setup</span>
                    </button>
                )}
            </div>

            <div key={`${activeTab}-${user?.id || 'anonymous'}`} role="tabpanel">
                <ManagementTabBoundary
                    key={activeTab}
                    tabName={activeTab === 'roles' ? 'Roles' : activeTab === 'approvals' ? 'Approval setup' : 'Users'}
                >
                    {activeTab === 'roles' ? (
                        <RoleManagement />
                    ) : activeTab === 'approvals' ? (
                        <ApprovalWorkflowManagement />
                    ) : activeTab === 'users' ? (
                        <EmployeeManagement />
                    ) : null}
                </ManagementTabBoundary>
            </div>
        </div>
    );
};

export default UserManagement;
