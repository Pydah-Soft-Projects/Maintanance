import React, { useState, useEffect, useMemo } from 'react';
import {
    FiEdit2,
    FiUsers,
    FiShield,
    FiX,
    FiSearch,
    FiPlus
} from 'react-icons/fi';
import { createRole, getRoles, updateRole } from '../../services/roleService';
import PermissionMatrix from '../../components/admin/PermissionMatrix';
import useAuthStore from '../../store/authStore';
import ApprovalRoleTypes from './ApprovalRoleTypes';
import './RoleManagement.css';

const MODULE_CONFIG = {
    ticket_dashboard: { label: 'Dashboard', chipClass: 'chip-blue' },
    ticket_management: { label: 'Complaints', chipClass: 'chip-emerald' },
    category_management: { label: 'Configuration', chipClass: 'chip-amber' },
    employee_management: { label: 'User Management', chipClass: 'chip-purple' }
};

const getActiveModules = (permissions) => {
    if (!permissions || typeof permissions !== 'object') return [];

    return Object.entries(MODULE_CONFIG)
        .map(([key, config]) => {
            const perms = permissions[key];
            if (!perms || typeof perms !== 'object') return null;
            const grantedCount = Object.values(perms).filter(Boolean).length;
            if (grantedCount === 0) return null;
            return {
                key,
                label: config.label,
                chipClass: config.chipClass,
                grantedCount
            };
        })
        .filter(Boolean);
};

const RoleManagement = () => {
    const currentUser = useAuthStore((state) => state.user);
    const canManageRoles = currentUser?.role === 'super_admin';
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        role_name: '',
        display_name: '',
        description: '',
        permissions: {}
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const response = await getRoles();
            setRoles(response.data || []);
        } catch (err) {
            console.error('Error fetching roles:', err);
            setError('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (role) => {
        setEditingRole(role);
        setFormData({
            role_name: role?.role_name || '',
            display_name: role?.display_name || '',
            description: role?.description || '',
            permissions: role?.permissions || {}
        });
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
        setFormData({
            role_name: '',
            display_name: '',
            description: '',
            permissions: {}
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const roleData = {
                role_name: formData.role_name,
                display_name: formData.display_name,
                description: formData.description,
                permissions: formData.permissions
            };
            if (editingRole) {
                await updateRole(editingRole.id, roleData);
                setSuccess('Role updated successfully!');
            } else {
                await createRole(roleData);
                setSuccess('Role created successfully!');
            }

            await fetchRoles();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving role:', err);
            setError(err.message || err.response?.data?.message || 'Failed to save role');
        }
    };

    // Filter active standard and custom roles by search text.
    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase().trim();
            const displayName = (role.display_name || '').toLowerCase();
            const roleName = (role.role_name || '').toLowerCase();
            const description = (role.description || '').toLowerCase();

            return displayName.includes(q) || roleName.includes(q) || description.includes(q);
        });
    }, [roles, searchQuery]);

    // Role totals include standard and custom roles.
    const stats = useMemo(() => {
        const totalUsers = roles.reduce((acc, role) => acc + (Number(role.employee_count) || 0), 0);
        return { total: roles.length, totalUsers };
    }, [roles]);

    if (loading) {
        return (
            <div className="role-management-page animate-pulse">
                {/* Stats Skeleton */}
                <div className="role-stats-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="stat-card-compact">
                            <div className="stat-icon-wrapper bg-slate-200"></div>
                            <div className="stat-content">
                                <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                                <div className="h-6 bg-slate-200 rounded w-10"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table Skeleton */}
                <div className="roles-table-card">
                    <div className="roles-table-toolbar">
                        <div className="h-10 bg-slate-200 rounded-xl w-80"></div>
                        <div className="h-10 bg-slate-200 rounded-xl w-52"></div>
                    </div>
                    <div className="p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-16 bg-slate-100 rounded-xl w-full"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="role-management-page">
            {/* Notification Alerts */}
            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            {/* Quick Metrics Header */}
            <div className="role-stats-grid">
                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-blue-50 text-blue-600 border border-blue-100">
                        <FiShield size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Available Roles</span>
                        <span className="stat-value">{stats.total}</span>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-amber-50 text-amber-600 border border-amber-100">
                        <FiUsers size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Assigned Users</span>
                        <span className="stat-value">{stats.totalUsers}</span>
                    </div>
                </div>
            </div>

            <ApprovalRoleTypes canManage={canManageRoles} />

            {/* Roles Table Container */}
            <div className="roles-table-card">
                {/* Search & Filter Controls Toolbar */}
                <div className="roles-table-toolbar">
                    <div className="roles-search-box">
                        <FiSearch className="search-icon" size={17} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search roles by name, slug, or description..."
                            className="roles-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="search-clear-btn"
                                title="Clear search"
                            >
                                <FiX size={15} />
                            </button>
                        )}
                    </div>
                    {canManageRoles && (
                        <button
                            type="button"
                            className="btn-primary inline-flex items-center gap-2"
                            onClick={() => handleOpenModal(null)}
                        >
                            <FiPlus size={16} />
                            Create Role
                        </button>
                    )}
                </div>

                {/* Mobile Scroll Affordance */}
                <div className="table-scroll-hint">
                    Swipe horizontally to view all columns &rarr;
                </div>

                {/* Table Element */}
                <div className="roles-table-scroll-container">
                    <table className="roles-table">
                        <thead>
                            <tr>
                                <th className="th-role">Role</th>
                                <th className="th-desc">Description</th>
                                <th className="th-users">Assigned Users</th>
                                <th className="th-perms">Permissions</th>
                                <th className="th-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoles.length > 0 ? (
                                filteredRoles.map(role => {
                                    const activeModules = getActiveModules(role.permissions);
                                    const isSystem = Boolean(role.is_system_role);
                                    return (
                                        <tr key={role.id} className="role-table-row">
                                            {/* Role Name & Slug */}
                                            <td>
                                                <div className="role-identity-cell">
                                                    <div className={`role-avatar-icon ${isSystem ? 'system' : 'custom'}`}>
                                                        <FiShield size={18} />
                                                    </div>
                                                    <div className="role-meta">
                                                        <div className="role-title-row">
                                                            <span className="role-display-name">{role.display_name}</span>
                                                            {isSystem ? (
                                                                <span className="badge-pill system">System Role</span>
                                                            ) : (
                                                                <span className="badge-pill custom">Custom</span>
                                                            )}
                                                        </div>
                                                        <span className="role-code-slug">{role.role_name}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td>
                                                <p className="role-desc-text">
                                                    {role.description || (
                                                        <span className="text-slate-400 italic">No description provided</span>
                                                    )}
                                                </p>
                                            </td>

                                            {/* Assigned Users Count */}
                                            <td>
                                                <div className="users-count-badge">
                                                    <FiUsers size={14} />
                                                    <span>
                                                        {role.employee_count || 0} {role.employee_count === 1 ? 'employee' : 'employees'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Granted Module Permissions */}
                                            <td>
                                                <div className="permissions-chips-wrap">
                                                    {activeModules.length === 0 ? (
                                                        <span className="permission-empty-chip">No permissions assigned</span>
                                                    ) : (
                                                        activeModules.map(mod => (
                                                            <span
                                                                key={mod.key}
                                                                className={`permission-chip ${mod.chipClass}`}
                                                                title={`${mod.label} (${mod.grantedCount} actions)`}
                                                            >
                                                                {mod.label}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </td>

                                            {/* Action Buttons */}
                                            <td>
                                                <div className="actions-cell">
                                                    {canManageRoles && <button
                                                        type="button"
                                                        className="action-btn edit"
                                                        onClick={() => handleOpenModal(role)}
                                                        title="Edit Role"
                                                    >
                                                        <FiEdit2 size={14} />
                                                        <span>Edit</span>
                                                    </button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        <div className="roles-empty-state">
                                            <div className="empty-icon-wrap">
                                                <FiShield size={32} />
                                            </div>
                                            <h3>No roles found</h3>
                                            <p>
                                                {searchQuery
                                                    ? `No roles match your search "${searchQuery}". Try a different keyword.`
                                                    : 'No roles found in this category.'}
                                            </p>
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    className="btn-secondary btn-sm mt-3"
                                                    onClick={() => setSearchQuery('')}
                                                >
                                                    Clear Search Filter
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editingRole
                                        ? `Update settings and permissions for ${editingRole.display_name}`
                                        : 'Create a role and configure its module permissions'}
                                </p>
                            </div>
                            <button className="close-btn" onClick={handleCloseModal} aria-label="Close">
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-error mb-4">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="alert alert-success mb-4">
                                        {success}
                                    </div>
                                )}

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Role Slug / Key *</label>
                                        <input
                                            type="text"
                                            value={formData.role_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                role_name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                                            })}
                                            disabled={Boolean(editingRole)}
                                            placeholder="e.g., principal, supervisor"
                                            required
                                            className="form-input"
                                        />
                                        <small className="form-hint">
                                            {editingRole
                                                ? 'Role keys cannot be changed after creation.'
                                                : 'Lowercase with underscores only (e.g. branch_admin).'}
                                        </small>
                                    </div>

                                    <div className="form-group">
                                        <label>Display Name *</label>
                                        <input
                                            type="text"
                                            value={formData.display_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                display_name: e.target.value
                                            })}
                                            placeholder="e.g., Principal, Supervisor"
                                            required
                                            className="form-input"
                                        />
                                        <small className="form-hint">
                                            Human readable name shown across the system.
                                        </small>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })}
                                        placeholder="Brief description of this role's scope and responsibilities..."
                                        rows="2"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="mb-2 block">Module Permissions Matrix</label>
                                    <PermissionMatrix
                                        permissions={formData.permissions}
                                        onChange={(newPermissions) => setFormData({
                                            ...formData,
                                            permissions: newPermissions
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseModal}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
