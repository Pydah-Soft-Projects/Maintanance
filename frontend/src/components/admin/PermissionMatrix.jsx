import React from 'react';
import { FiLock, FiUnlock, FiCheckSquare, FiSquare } from 'react-icons/fi';
import './PermissionMatrix.css';

/**
 * Permission Matrix Component
 * Displays a clean grid of modules and their permissions (READ, WRITE, UPDATE, DELETE)
 */
const PermissionMatrix = ({
    permissions = {},
    onChange,
    disabled = false,
    modules = null
}) => {
    // Default modules structure
    const defaultModules = {
        ticket_dashboard: {
            label: 'Dashboard',
            permissions: {
                read: 'View Dashboard'
            }
        },
        ticket_management: {
            label: 'Complaints',
            permissions: {
                read: 'Open Complaints',
                pending: 'View Pending tab',
                assigned: 'View Assigned / In Progress tab',
                resolved: 'View Resolved tab',
                student: 'View Student complaints',
                faculty: 'View Faculty complaints',
                write: 'Create Tickets',
                update: 'Update Tickets',
                delete: 'Delete Tickets'
            }
        },
        employee_management: {
            label: 'User Management',
            permissions: {
                read: 'Open User Management',
                users: 'View Users tab',
                roles: 'View Roles tab',
                write: 'Create Users',
                update: 'Update Users',
                delete: 'Remove Users'
            }
        },
        category_management: {
            label: 'Configuration',
            permissions: {
                read: 'Open Configuration',
                write: 'Create Categories',
                update: 'Update Categories',
                delete: 'Delete Categories'
            }
        },
    };

    const modulesData = modules || defaultModules;

    const handlePermissionChange = (moduleKey, permissionKey, value) => {
        if (disabled) return;

        const updatedPermissions = {
            ...permissions,
            [moduleKey]: {
                ...(permissions[moduleKey] || {}),
                [permissionKey]: value
            }
        };

        onChange(updatedPermissions);
    };

    const handleToggleAllModule = (moduleKey, modulePermissions, select) => {
        if (disabled) return;

        const updatedModulePerms = {};
        Object.keys(modulePermissions).forEach(action => {
            updatedModulePerms[action] = select;
        });

        onChange({
            ...permissions,
            [moduleKey]: updatedModulePerms
        });
    };

    const handleSelectAll = (select) => {
        if (disabled) return;

        const newPermissions = {};
        Object.entries(modulesData).forEach(([modKey, modObj]) => {
            newPermissions[modKey] = {};
            Object.keys(modObj.permissions).forEach(action => {
                newPermissions[modKey][action] = select;
            });
        });

        onChange(newPermissions);
    };

    const hasAnyPermission = (moduleKey) => {
        const modulePerms = permissions[moduleKey];
        if (!modulePerms) return false;
        return Object.values(modulePerms).some(val => val === true);
    };

    const hasAllModulePermissions = (moduleKey, modulePermissions) => {
        const modulePerms = permissions[moduleKey];
        if (!modulePerms) return false;
        return Object.keys(modulePermissions).every(action => modulePerms[action] === true);
    };

    return (
        <div className="permission-matrix">
            <div className="permission-matrix-header">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Module Permissions Matrix</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Configure granular access rights for each operational module
                    </p>
                </div>
                {!disabled && (
                    <div className="matrix-quick-actions">
                        <button
                            type="button"
                            className="matrix-quick-btn"
                            onClick={() => handleSelectAll(true)}
                        >
                            <FiCheckSquare size={13} />
                            <span>Grant All</span>
                        </button>
                        <button
                            type="button"
                            className="matrix-quick-btn text-slate-500"
                            onClick={() => handleSelectAll(false)}
                        >
                            <FiSquare size={13} />
                            <span>Clear All</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="permission-modules-grid">
                {Object.entries(modulesData).map(([moduleKey, moduleData]) => {
                    const modulePerms = permissions[moduleKey] || {};
                    const hasAccess = hasAnyPermission(moduleKey);
                    const isAllSelected = hasAllModulePermissions(moduleKey, moduleData.permissions);

                    return (
                        <div
                            key={moduleKey}
                            className={`permission-module-card ${hasAccess ? 'has-access' : ''}`}
                        >
                            <div className="module-header">
                                <div className="module-title-wrap">
                                    <div className="module-icon">
                                        {hasAccess ? (
                                            <FiUnlock className="text-emerald-600" size={15} />
                                        ) : (
                                            <FiLock className="text-slate-400" size={15} />
                                        )}
                                    </div>
                                    <h4 className="module-title">{moduleData.label}</h4>
                                </div>
                                {!disabled && (
                                    <button
                                        type="button"
                                        className="module-card-toggle-btn"
                                        onClick={() => handleToggleAllModule(moduleKey, moduleData.permissions, !isAllSelected)}
                                    >
                                        {isAllSelected ? 'Clear' : 'Select all'}
                                    </button>
                                )}
                            </div>

                            <div className="module-permissions">
                                {Object.entries(moduleData.permissions).map(([permKey, permLabel]) => {
                                    const isChecked = modulePerms[permKey] === true;
                                    return (
                                        <label
                                            key={permKey}
                                            className={`permission-checkbox ${disabled ? 'disabled' : ''} ${isChecked ? 'checked' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handlePermissionChange(
                                                    moduleKey,
                                                    permKey,
                                                    e.target.checked
                                                )}
                                                disabled={disabled}
                                            />
                                            <div className="permission-label">
                                                <span className={`permission-action perm-${permKey.toLowerCase()}`}>
                                                    {permKey.toUpperCase()}
                                                </span>
                                                <span className="permission-desc-text">
                                                    {permLabel}
                                                </span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PermissionMatrix;
