import React, { useState, useEffect } from 'react';
import {
    Search,
    X,
    Check,
    Shield,
    Briefcase,
    CheckCircle2
} from 'lucide-react';
import api from '../../config/api';

const EmployeeModal = ({
    isOpen,
    onClose,
    user: editingUser,
    availableRoles = [],
    canAssignAdminRoles = false,
    onSubmit,
    isSubmitting
}) => {
    const [userSearch, setUserSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [hrmsEmployees, setHrmsEmployees] = useState([]);
    const [isHrmsLoading, setIsHrmsLoading] = useState(false);
    const [workerServiceGroups, setWorkerServiceGroups] = useState([]);
    const [selectedHrmsUser, setSelectedHrmsUser] = useState(null);

    const [formData, setFormData] = useState({
        hrms_employee_id: null,
        hrms_employee_no: '',
        name: '',
        role: null,
        custom_role_id: null,
        assigned_categories: [],
        assigned_subcategories: [],
        service_group_ids: []
    });

    const isWorker = formData.role === 'worker';
    const isAdminRole = ['sub_admin', 'super_admin'].includes(formData.role);
    // Debounce search input (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(userSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch]);

    useEffect(() => {
        if (isOpen) {
            fetchWorkerServiceGroups();
        }
    }, [isOpen]);

    const fetchWorkerServiceGroups = async () => {
        try {
            const response = await api.get('/approval-workflows');
            setWorkerServiceGroups(
                (response.data?.data?.groups || []).filter((group) => group.member_type === 'worker')
            );
        } catch (error) {
            console.error('Failed to fetch worker service types:', error);
        }
    };

    // Live search HRMS employees
    useEffect(() => {
        if (!isOpen || editingUser) return;

        let isMounted = true;
        const fetchHrms = async () => {
            setIsHrmsLoading(true);
            try {
                const response = await api.get('/employees/hrms-directory', {
                    params: debouncedSearch ? { search: debouncedSearch } : {}
                });
                if (isMounted) {
                    setHrmsEmployees(response.data?.data || []);
                }
            } catch (err) {
                console.error('Failed to query HRMS directory:', err);
            } finally {
                if (isMounted) setIsHrmsLoading(false);
            }
        };

        fetchHrms();
        return () => { isMounted = false; };
    }, [isOpen, editingUser, debouncedSearch]);

    useEffect(() => {
        if (isOpen) {
            setUserSearch('');
            setDebouncedSearch('');
            if (editingUser) {
                setSelectedHrmsUser({
                    emp_no: editingUser.username,
                    name: editingUser.name,
                    email: editingUser.email,
                    phone: editingUser.phone
                });
                setFormData({
                    id: editingUser.id,
                    hrms_employee_id: editingUser.hrms_id || null,
                    hrms_employee_no: editingUser.username || '',
                    name: editingUser.name || '',
                    role: editingUser.role || null,
                    custom_role_id: editingUser.custom_role_id || null,
                    assigned_categories: editingUser.assigned_categories || [],
                    assigned_subcategories: editingUser.assigned_subcategories || [],
                    service_group_ids: editingUser.service_group_ids || []
                });
            } else {
                setSelectedHrmsUser(null);
                setFormData({
                    hrms_employee_id: null,
                    hrms_employee_no: '',
                    name: '',
                    role: null,
                    custom_role_id: null,
                    assigned_categories: [],
                    assigned_subcategories: [],
                    service_group_ids: []
                });
            }
        }
    }, [isOpen, editingUser]);

    const handleSelectHrmsUser = (employee) => {
        if (employee.is_already_added) return;
        setSelectedHrmsUser(employee);
        setFormData(prev => ({
            ...prev,
            hrms_employee_id: employee.id,
            hrms_employee_no: employee.emp_no,
            name: employee.name || employee.employee_name || employee.emp_no
        }));
    };

    const handleSubmit = () => {
        if (!editingUser && !formData.hrms_employee_id) return;
        if (!formData.name?.trim()) return;
        if (!formData.role) return;
        if (formData.role === 'worker' && formData.service_group_ids.length === 0) return;

        onSubmit(editingUser ? 'update' : 'create', formData);
    };

    if (!isOpen) return null;
    const allWorkerServiceGroupIds = workerServiceGroups.map((group) => Number(group.id));
    const hasAllWorkerServiceTypes = allWorkerServiceGroupIds.length > 0 &&
        allWorkerServiceGroupIds.every((id) => formData.service_group_ids.includes(id));

    return (
        <div className="employee-modal-overlay">
            <div className="employee-modal-container">
                {/* Header */}
                <div className="employee-modal-header">
                    <div>
                        <h2 className="employee-modal-title">{editingUser ? 'Edit User' : 'Create User from HRMS'}</h2>
                        <p className="employee-modal-subtitle">
                            {editingUser
                                ? 'Update the user, role, and service access in one place'
                                : 'Select an HRMS employee, choose a role, and assign services if needed'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="employee-modal-close-btn"
                        type="button"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable Area */}
                <div className="employee-modal-content employee-form-grid custom-scrollbar">
                    {/* Step 1: Select HRMS Employee (Create mode) */}
                    {!editingUser && (
                        <section className="employee-form-panel employee-hrms-panel animate-fade-in">
                            <div className="employee-panel-heading">
                                <span className="employee-panel-icon"><Search size={16} /></span>
                                <div>
                                    <h3>Find an employee</h3>
                                    <p>Search the HRMS directory</p>
                                </div>
                            </div>
                            <div className="user-search-container employee-compact-search">
                                <div className="user-search-icon">
                                    <Search size={17} />
                                </div>
                                <input
                                    className="user-search-input"
                                    placeholder="Name, employee ID, phone..."
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Employee Results */}
                            <div className="user-list-grid employee-compact-results custom-scrollbar">
                                {isHrmsLoading ? (
                                    <div className="employee-empty-message">
                                        <span className="employee-loading-spinner" />
                                        Searching HRMS...
                                    </div>
                                ) : hrmsEmployees.length > 0 ? (
                                    hrmsEmployees.map(emp => {
                                        const isSelected = formData.hrms_employee_id === emp.id;
                                        const isAlreadyAdded = emp.is_already_added;

                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => !isAlreadyAdded && handleSelectHrmsUser(emp)}
                                                className={`user-select-card employee-compact-user ${isSelected ? 'selected' : ''}`}
                                                style={isAlreadyAdded ? { opacity: 0.55, cursor: 'not-allowed', backgroundColor: 'var(--gray-50)' } : {}}
                                            >
                                                <div className="user-avatar">
                                                    {(emp.name || emp.emp_no || 'E').charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-900)' }}>
                                                            {emp.name || emp.employee_name}
                                                        </span>
                                                        {isAlreadyAdded && (
                                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '0.25rem', backgroundColor: 'var(--border, #E5E7EB)', color: 'var(--text-primary, #333333)' }}>
                                                                Already Added
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.125rem' }}>
                                                        ID: <strong style={{ color: 'var(--gray-700)' }}>{emp.emp_no}</strong>
                                                        {emp.email ? ` · ${emp.email}` : ''}
                                                        {emp.phone ? ` · ${emp.phone}` : ''}
                                                    </div>
                                                </div>
                                                <div className="user-check-indicator">
                                                    {isSelected && <Check size={12} style={{ color: 'white' }} strokeWidth={3} />}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="employee-empty-message">
                                        No active employees found matching &ldquo;{userSearch}&rdquo; in HRMS.
                                    </div>
                                )}
                            </div>

                            {/* Selected Employee Customization */}
                            {selectedHrmsUser && (
                                <div className="employee-selected-summary">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--green-700)', fontSize: '0.875rem', fontWeight: 600 }}>
                                        <CheckCircle2 size={18} />
                                        <span>{selectedHrmsUser.name} <span className="font-normal text-slate-500">· {selectedHrmsUser.emp_no}</span></span>
                                    </div>
                                    <label className="form-label" htmlFor="ticket-employee-name">
                                        Ticket-app Display Name <span style={{ color: 'var(--red-500)' }}>*</span>
                                    </label>
                                    <input
                                        id="ticket-employee-name"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                        maxLength={255}
                                        required
                                    />
                                </div>
                            )}
                        </section>
                    )}

                    {/* Step 1: User Info (Edit mode) */}
                    {editingUser && (
                        <section className="employee-form-panel employee-identity-panel animate-fade-in">
                            <div className="employee-panel-heading">
                                <span className="employee-panel-icon"><CheckCircle2 size={16} /></span>
                                <div>
                                    <h3>User details</h3>
                                    <p>HRMS account information</p>
                                </div>
                            </div>
                            <div className="employee-identity-summary">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div className="user-avatar" style={{ width: '2.5rem', height: '2.5rem' }}>
                                        {(editingUser.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{editingUser.name}</h3>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                                            <strong style={{ color: 'var(--gray-700)' }}>{editingUser.username}</strong>
                                            {editingUser.email ? ` · ${editingUser.email}` : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="form-label" htmlFor="user-name">
                                    Display Name <span style={{ color: 'var(--red-500)' }}>*</span>
                                </label>
                                <input
                                    id="user-name"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="employee-auth-note">
                                Password authentication is verified centrally by HRMS.
                            </div>
                        </section>
                    )}

                    <section className="employee-form-panel employee-role-panel animate-fade-in">
                        <div className="employee-panel-heading">
                            <span className="employee-panel-icon"><Shield size={16} /></span>
                            <div>
                                <h3>Access role</h3>
                                <p>Choose what this user can do</p>
                            </div>
                        </div>
                        <label className="employee-field-label" htmlFor="employee-role">Role</label>
                        <select
                            id="employee-role"
                            className="employee-role-select"
                            value={formData.role || ''}
                            onChange={(event) => {
                                const selectedRole = availableRoles.find((role) => role.role_name === event.target.value);
                                setFormData((current) => ({
                                    ...current,
                                    role: selectedRole?.role_name || null,
                                    custom_role_id: selectedRole?.id || null,
                                    service_group_ids: selectedRole?.role_name === 'worker'
                                        ? current.service_group_ids
                                        : []
                                }));
                            }}
                            required
                        >
                            <option value="" disabled>Select a role</option>
                            {availableRoles.map((role) => {
                                const isAdminRole = ['sub_admin', 'super_admin'].includes(role.role_name);
                                return (
                                    <option
                                        key={role.id}
                                        value={role.role_name}
                                        disabled={isAdminRole && !canAssignAdminRoles}
                                    >
                                        {role.display_name}{isAdminRole && !canAssignAdminRoles ? ' (Superadmin only)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        {availableRoles.find((role) => role.role_name === formData.role)?.description && (
                            <p className="employee-role-description">
                                {availableRoles.find((role) => role.role_name === formData.role).description}
                            </p>
                        )}
                        {isAdminRole && (
                            <div className="employee-admin-service-note">
                                <CheckCircle2 size={16} />
                                <span>All service areas are included automatically for this role.</span>
                            </div>
                        )}
                    </section>

                    {isWorker && (
                        <section className="employee-form-panel employee-services-panel animate-fade-in">
                            <div className="employee-services-heading">
                                <div>
                                    <h3>Worker service types</h3>
                                    <p>Select at least one service area</p>
                                </div>
                                {workerServiceGroups.length > 0 && (
                                    <button
                                        type="button"
                                        className="employee-select-all-services"
                                        disabled={hasAllWorkerServiceTypes}
                                        onClick={() => setFormData((current) => ({
                                            ...current,
                                            service_group_ids: allWorkerServiceGroupIds
                                        }))}
                                    >
                                        {hasAllWorkerServiceTypes ? 'All selected' : 'Select all'}
                                    </button>
                                )}
                            </div>
                            {workerServiceGroups.length ? (
                                <div className="employee-service-options">
                                    {workerServiceGroups.map((group) => {
                                        const selected = formData.service_group_ids.includes(Number(group.id));
                                        return (
                                            <button
                                                key={group.id}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setFormData((current) => ({
                                                    ...current,
                                                    service_group_ids: selected
                                                        ? current.service_group_ids.filter((id) => id !== Number(group.id))
                                                        : [...current.service_group_ids, Number(group.id)]
                                                }))}
                                                className={`employee-service-option ${selected ? 'selected' : ''}`}
                                            >
                                                <span className="employee-service-checkbox">{selected && <Check size={12} />}</span>
                                                <span className="font-semibold">{group.service_type}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="employee-service-empty">
                                    Add Worker service types in Role Management before assigning a Worker.
                                </p>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="employee-modal-footer">
                    <div className="footer-btn-container">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-back"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="btn-submit"
                                disabled={isSubmitting || !formData.name.trim() || !formData.role ||
                                    (!editingUser && !formData.hrms_employee_id) ||
                                    (formData.role === 'worker' && formData.service_group_ids.length === 0)}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} strokeWidth={2.5} />
                                        <span>{editingUser ? 'Update User' : 'Register User'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeModal;
