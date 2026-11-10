import React, { useState, useEffect } from 'react';
import {
    Search,
    X,
    Check,
    ChevronDown,
    ChevronRight,
    Folder,
    Target,
    Shield,
    Briefcase,
    UserCircle,
    ArrowRight,
    ArrowLeft,
    Mail,
    Phone,
    Info,
    CheckCircle2
} from 'lucide-react';
import api from '../../config/api';

const EmployeeModal = ({
    isOpen,
    onClose,
    user: editingUser,
    availableRoles = [],
    onSubmit,
    isSubmitting
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [hrmsEmployees, setHrmsEmployees] = useState([]);
    const [isHrmsLoading, setIsHrmsLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState([]);
    const [selectedHrmsUser, setSelectedHrmsUser] = useState(null);

    const [formData, setFormData] = useState({
        hrms_employee_id: null,
        hrms_employee_no: '',
        name: '',
        role: null,
        custom_role_id: null,
        assigned_categories: [],
        assigned_subcategories: []
    });

    // Dynamic steps configuration: Worker doesn't need category scope selection
    const isWorker = formData.role === 'worker' || formData.role === 'ticket_worker';
    const shouldShowCategorySelection = !isWorker;

    const steps = [
        { type: 'info', title: editingUser ? 'User Details' : 'Select HRMS Employee', icon: UserCircle },
        { type: 'role', title: 'Select Role', icon: Shield },
        ...(shouldShowCategorySelection ? [{ type: 'categories', title: 'Select Scope', icon: Briefcase }] : [])
    ].map((step, index) => ({ ...step, number: index + 1 }));

    const totalSteps = steps.length;
    const currentStepObj = steps[currentStep - 1] || steps[0];

    // Debounce search input (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(userSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch]);

    // Fetch categories on open
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/complaint-categories');
            const data = response.data?.data || [];
            const normalized = data.map(cat => ({
                ...cat,
                subcategories: cat.sub_categories || cat.subcategories || []
            }));
            setCategories(normalized);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
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
            setCurrentStep(1);

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
                    assigned_subcategories: editingUser.assigned_subcategories || []
                });
                setExpandedCategories(editingUser.assigned_categories || []);
            } else {
                setSelectedHrmsUser(null);
                setFormData({
                    hrms_employee_id: null,
                    hrms_employee_no: '',
                    name: '',
                    role: null,
                    custom_role_id: null,
                    assigned_categories: [],
                    assigned_subcategories: []
                });
                setExpandedCategories([]);
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

        onSubmit(editingUser ? 'update' : 'create', formData);
    };

    const canProceedToNextStep = () => {
        if (currentStepObj.type === 'info') {
            if (!editingUser) {
                return Boolean(formData.hrms_employee_id && formData.name.trim());
            }
            return Boolean(formData.name.trim());
        }
        if (currentStepObj.type === 'role') {
            return Boolean(formData.role);
        }
        return true;
    };

    const handleNext = () => {
        if (canProceedToNextStep() && currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleCategoryToggle = (categoryId) => {
        setFormData(prev => {
            const isSelected = prev.assigned_categories.includes(categoryId);
            const newCategories = isSelected
                ? prev.assigned_categories.filter(id => id !== categoryId)
                : [...prev.assigned_categories, categoryId];

            let newSubcategories = prev.assigned_subcategories;
            if (isSelected) {
                const category = categories.find(c => c.id === categoryId);
                if (category && category.subcategories) {
                    const subcategoryIds = category.subcategories.map(sc => sc.id);
                    newSubcategories = newSubcategories.filter(id => !subcategoryIds.includes(id));
                }
            }

            return {
                ...prev,
                assigned_categories: newCategories,
                assigned_subcategories: newSubcategories
            };
        });
    };

    const handleSubcategoryToggle = (subcategoryId, parentId) => {
        setFormData(prev => {
            const isSelected = prev.assigned_subcategories.includes(subcategoryId);
            const newSubcategories = isSelected
                ? prev.assigned_subcategories.filter(id => id !== subcategoryId)
                : [...prev.assigned_subcategories, subcategoryId];

            let newCategories = prev.assigned_categories;
            if (!isSelected && !newCategories.includes(parentId)) {
                newCategories = [...newCategories, parentId];
            }

            return {
                ...prev,
                assigned_categories: newCategories,
                assigned_subcategories: newSubcategories
            };
        });
    };

    if (!isOpen) return null;

    const mainCategories = categories.filter(c => !c.parent_id);

    return (
        <div className="employee-modal-overlay">
            <div className="employee-modal-container">
                {/* Header */}
                <div className="employee-modal-header">
                    <div>
                        <h2 className="employee-modal-title">{editingUser ? 'Edit User' : 'Create User from HRMS'}</h2>
                        <p className="employee-modal-subtitle">
                            {currentStep === 1
                                ? (editingUser ? 'Update user display name' : 'Search & select an active employee from HRMS')
                                : currentStep === 2
                                    ? 'Assign ticket access role'
                                    : 'Configure category responsibilities'}
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

                {/* Progress Steps */}
                {totalSteps > 1 && (
                    <div className="employee-steps-container">
                        <div className="employee-steps-wrapper">
                            {steps.map((step, index) => (
                                <React.Fragment key={step.number}>
                                    <div className="step-item">
                                        <div
                                            className={`step-circle ${currentStep >= step.number ? 'active' : 'inactive'}`}
                                        >
                                            {currentStep > step.number ? <Check size={14} strokeWidth={3} /> : step.number}
                                        </div>
                                        <span
                                            className={`step-label ${currentStep >= step.number ? 'active' : 'inactive'}`}
                                        >
                                            {step.title}
                                        </span>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className="step-connector">
                                            <div
                                                className="step-connector-progress"
                                                style={{ width: currentStep > step.number ? '100%' : '0%' }}
                                            />
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {/* Body - Scrollable Area */}
                <div className="employee-modal-content custom-scrollbar">
                    {/* Step 1: Select HRMS Employee (Create mode) */}
                    {currentStepObj.type === 'info' && !editingUser && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '42rem', margin: '0 auto', width: '100%' }}>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2.5">
                                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">HRMS Directory Search</p>
                                    <p className="text-blue-700 mt-0.5">
                                        Select an employee from the HRMS connection. Only this selected user will be added to the ticket database. Passwords are validated through HRMS during login.
                                    </p>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="user-search-container">
                                <div className="user-search-icon">
                                    <Search className="h-5 w-5" />
                                </div>
                                <input
                                    className="user-search-input"
                                    placeholder="Search HRMS by employee ID, name, or phone number..."
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Employee Results */}
                            <div className="user-list-grid custom-scrollbar">
                                {isHrmsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--gray-500)' }}>
                                        <div style={{ width: '1.5rem', height: '1.5rem', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                                        <span style={{ fontSize: '0.875rem' }}>Searching HRMS directory...</span>
                                    </div>
                                ) : hrmsEmployees.length > 0 ? (
                                    hrmsEmployees.map(emp => {
                                        const isSelected = formData.hrms_employee_id === emp.id;
                                        const isAlreadyAdded = emp.is_already_added;

                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => !isAlreadyAdded && handleSelectHrmsUser(emp)}
                                                className={`user-select-card ${isSelected ? 'selected' : ''}`}
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
                                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '0.25rem', backgroundColor: '#e2e8f0', color: '#000000' }}>
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
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                                        No active employees found matching &ldquo;{userSearch}&rdquo; in HRMS.
                                    </div>
                                )}
                            </div>

                            {/* Selected Employee Customization */}
                            {selectedHrmsUser && (
                                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--green-700)', fontSize: '0.875rem', fontWeight: 600 }}>
                                        <CheckCircle2 size={18} />
                                        <span>Selected HRMS Employee: {selectedHrmsUser.name} ({selectedHrmsUser.emp_no})</span>
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
                        </div>
                    )}

                    {/* Step 1: User Info (Edit mode) */}
                    {currentStepObj.type === 'info' && editingUser && (
                        <div className="animate-fade-in" style={{ maxWidth: '36rem', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--gray-200)', backgroundColor: 'var(--gray-50)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div className="user-avatar" style={{ width: '3rem', height: '3rem', fontSize: '1.25rem' }}>
                                        {(editingUser.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{editingUser.name}</h3>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                                            HRMS Username: <strong style={{ color: 'var(--gray-700)' }}>{editingUser.username}</strong>
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

                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', backgroundColor: 'var(--primary-blue-light)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                                Password authentication is verified centrally by HRMS.
                            </div>
                        </div>
                    )}

                    {/* Step 2: Role Selection */}
                    {currentStepObj.type === 'role' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <h3 className="employee-modal-title">Choose Role</h3>
                                <p className="employee-modal-subtitle">Select the access permissions for this user</p>
                            </div>

                            <div className="role-select-grid">
                                {availableRoles && availableRoles.length > 0 ? (
                                    availableRoles.map(role => {
                                        const isRoleWorker = role.role_name.includes('worker');
                                        const isSelected = formData.custom_role_id === role.id || formData.role === role.role_name;

                                        return (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    role: role.role_name,
                                                    custom_role_id: role.id
                                                })}
                                                className={`role-card ${isSelected ? `active ${isRoleWorker ? 'role-worker' : 'role-staff'}` : ''}`}
                                            >
                                                <div className={`role-icon ${isRoleWorker ? 'worker-icon-hover' : ''}`}>
                                                    {isRoleWorker ? <Briefcase size={28} /> : <Shield size={28} />}
                                                </div>
                                                <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                                                    {role.display_name}
                                                </h4>
                                                <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', lineHeight: '1.625' }}>
                                                    {role.description || 'Access to ticket system features.'}
                                                </p>

                                                {isSelected && (
                                                    <div className="role-selection-check">
                                                        <Check size={14} style={{ color: 'white' }} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--gray-500)' }}>
                                        No roles available.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Category Assignment */}
                    {currentStepObj.type === 'categories' && (
                        <div className="category-selection-container animate-fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--gray-900)' }}>Choose Categories</h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Select categories assigned to this user</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: 'var(--primary-blue-light)', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #bfdbfe' }}>
                                        {formData.assigned_categories.length} Categories
                                    </span>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: '#f3e8ff', color: '#9333ea', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #e9d5ff' }}>
                                        {formData.assigned_subcategories.length} Subcategories
                                    </span>
                                </div>
                            </div>

                            <div className="category-list-box custom-scrollbar">
                                {mainCategories.map(category => {
                                    const isExpanded = expandedCategories.includes(category.id);
                                    const isSelected = formData.assigned_categories.includes(category.id);
                                    const hasSubcategories = category.subcategories?.length > 0;

                                    return (
                                        <div key={category.id} style={{ marginBottom: '0.25rem' }}>
                                            <div className={`category-item ${isSelected ? 'selected' : ''}`}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
                                                    className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                                                >
                                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </button>

                                                <div
                                                    className="category-content"
                                                    onClick={() => handleCategoryToggle(category.id)}
                                                >
                                                    <Folder size={18} style={{ color: isSelected ? 'var(--primary-blue)' : 'var(--gray-400)' }} fill={isSelected ? "currentColor" : "none"} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: isSelected ? 'var(--primary-blue-dark)' : 'var(--gray-700)' }}>
                                                        {category.name}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`category-checkbox ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => handleCategoryToggle(category.id)}
                                                >
                                                    {isSelected && <Check size={12} style={{ color: 'white' }} strokeWidth={3} />}
                                                </div>
                                            </div>

                                            {isExpanded && hasSubcategories && (
                                                <div className="subcategory-list">
                                                    {category.subcategories.map(sub => {
                                                        const isSubSelected = formData.assigned_subcategories.includes(sub.id);
                                                        return (
                                                            <div
                                                                key={sub.id}
                                                                className={`subcategory-item ${isSubSelected ? 'selected' : ''}`}
                                                                onClick={() => handleSubcategoryToggle(sub.id, category.id)}
                                                            >
                                                                <Target size={14} style={{ marginRight: '0.5rem', color: isSubSelected ? '#9333ea' : 'var(--gray-400)' }} />
                                                                <span style={{ fontSize: '0.875rem', flex: 1, fontWeight: isSubSelected ? '500' : '400', color: isSubSelected ? '#581c87' : 'var(--gray-600)' }}>
                                                                    {sub.name}
                                                                </span>
                                                                <div className={`subcategory-checkbox ${isSubSelected ? 'selected' : ''}`}>
                                                                    {isSubSelected && <Check size={10} style={{ color: 'white' }} strokeWidth={3} />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="employee-modal-footer">
                    <div className="footer-btn-container">
                        <button
                            type="button"
                            onClick={currentStep === 1 ? onClose : handleBack}
                            className="btn-back"
                            disabled={isSubmitting}
                        >
                            <ArrowLeft size={16} />
                            {currentStep === 1 ? 'Cancel' : 'Back'}
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {currentStep < totalSteps ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={!canProceedToNextStep()}
                                    className="btn-next"
                                >
                                    <span>Next Step</span>
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="btn-submit"
                                    disabled={isSubmitting || !formData.name.trim() || !formData.role}
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeModal;
