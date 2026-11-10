
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FolderTree,
    Plus,
    Edit,
    Trash2,
    X,
    Save,
    List
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import '../../styles/admin-pages.css';

const ToggleSwitch = ({ checked, onChange, label, ariaLabel }) => (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel || label || 'Toggle status'}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
                focus:ring-blue-600 focus:ring-offset-2
                ${checked ? 'bg-green-500' : 'bg-gray-300'}
            `}
        >
            <span
                aria-hidden="true"
                className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
        {label && (
            <span className={`text-sm font-medium ${checked ? 'text-gray-900' : 'text-gray-500'}`}>
                {label}
            </span>
        )}
    </div>
);

const TicketConfiguration = () => {
    const [editingHeader, setEditingHeader] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        parent_id: null,
        is_active: true
    });
    const queryClient = useQueryClient();

    // Data Fetching
    const { data: categoriesData, isLoading } = useQuery({
        queryKey: ['complaint-categories'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories');
            return response.data?.data || [];
        }
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post('/complaint-categories', data);
            return response.data;
        },
        onSuccess: (_, createdCategory) => {
            toast.success('Successfully created');
            setShowAddModal(false);
            setFormData({ name: '', description: '', parent_id: null, is_active: true });
            if (createdCategory.parent_id != null) {
                setSelectedCategoryId(createdCategory.parent_id);
            }
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create')
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const response = await api.put(`/complaint-categories/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Successfully updated');
            setEditingHeader(null);
            setShowAddModal(false);
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update')
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const response = await api.delete(`/complaint-categories/${id}`);
            return response.data;
        },
        onSuccess: (_, id) => {
            toast.success('Successfully deleted');
            if (selectedCategoryId === id) setSelectedCategoryId(null);
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
    });

    // Handlers
    const handleSave = () => {
        if (!formData.name.trim()) return toast.error('Name is required');
        if (editingHeader) {
            updateMutation.mutate({ id: editingHeader.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (category) => {
        if (window.confirm(`Delete "${category.name}"?`)) {
            deleteMutation.mutate(category.id);
        }
    };

    const openAddModal = (parentId = null) => {
        if (parentId != null) setSelectedCategoryId(null);
        setEditingHeader(null);
        setFormData({ name: '', description: '', parent_id: parentId, is_active: true });
        setShowAddModal(true);
    };

    const openEditModal = (category) => {
        setEditingHeader(category);
        setFormData({
            name: category.name || '',
            description: category.description || '',
            parent_id: category.parent_id ?? null,
            is_active: Boolean(category.is_active)
        });
        setShowAddModal(true);
    };

    if (isLoading) {
        return (
            <div className="admin-page-container animate-pulse">
                <div className="card-base p-0 border rounded-lg bg-white">
                    <div className="card-header p-4 border-b">
                        <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-64"></div>
                    </div>
                    <div className="card-body p-4 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="h-14 bg-gray-50 rounded border flex items-center px-4 justify-between">
                                    <div className="flex gap-4 items-center w-full">
                                        <div className="w-5 h-5 bg-gray-200 rounded"></div>
                                        <div className="h-5 bg-gray-200 rounded w-48"></div>
                                        <div className="h-6 w-12 bg-gray-200 rounded-full"></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                                {i === 2 && (
                                    <div className="ml-8 space-y-2 border-l pl-4">
                                        <div className="h-10 bg-gray-50 rounded border w-3/4"></div>
                                        <div className="h-10 bg-gray-50 rounded border w-3/4"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const headers = categoriesData || [];

    return (
        <div className="admin-page-container">
            <header className="page-header">
                <h1 className="page-title">Configuration</h1>
                <p className="page-subtitle">Manage the categories and options used in support requests.</p>
            </header>

            <div className="card-base" style={{ padding: 0 }}>
                <div className="card-header flex justify-between items-center gap-4 flex-wrap">
                    <div>
                        <h3 className="card-title">Complaints Hierarchy</h3>
                        <p className="card-subtitle">Define categories and their sub-items</p>
                    </div>
                    <button onClick={() => openAddModal()} className="btn-primary py-2 px-3 text-xs shrink-0">
                        <Plus size={16} /> <span>Create Category</span>
                    </button>
                </div>
                <div className="card-body">
                    {headers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <List size={32} />
                            </div>
                            <p className="empty-state-text">No headers configured yet</p>
                            <button onClick={() => openAddModal()} className="empty-state-action">
                                Create your first header
                            </button>
                        </div>
                    ) : (
                        <div className="configuration-category-grid">
                        {headers.map((header) => (
                            <HeaderItem
                                key={header.id}
                                header={header}
                                onOpen={() => setSelectedCategoryId(header.id)}
                                onEdit={() => openEditModal(header)}
                                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                                onDelete={() => handleDelete(header)}
                            />
                        ))
                        }
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-md">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingHeader ? 'Edit Category' : formData.parent_id ? 'Add Sub-category' : 'Add Category'}
                            </h2>
                            <button onClick={() => { setShowAddModal(false); setEditingHeader(null); }} className="modal-close-btn" aria-label="Close dialog"><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            {formData.parent_id && (
                                <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                    {editingHeader ? 'Under category:' : 'Adding under:'}{' '}
                                    <strong>{headers.find(h => h.id === formData.parent_id)?.name}</strong>
                                </div>
                            )}
                            <div>
                                <label className="form-label" htmlFor="configuration-category-name">Name</label>
                                <input
                                    id="configuration-category-name"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter category name"
                                />
                            </div>
                            <div>
                                <label className="form-label" htmlFor="configuration-category-description">Description</label>
                                <textarea
                                    id="configuration-category-description"
                                    className="form-textarea"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <ToggleSwitch
                                    checked={formData.is_active}
                                    onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    label="Active"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => { setShowAddModal(false); setEditingHeader(null); }} className="btn-secondary">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="btn-primary"
                            >
                                <Save size={16} />
                                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingHeader ? 'Save changes' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedCategoryId !== null && (() => {
                const selectedCategory = headers.find((category) => category.id === selectedCategoryId);
                if (!selectedCategory) return null;

                return (
                    <div className="modal-overlay configuration-details-overlay" onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setSelectedCategoryId(null);
                    }}>
                        <section
                            className="modal-content configuration-details-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="configuration-details-title"
                        >
                            <header className="configuration-details-header">
                                <div>
                                    <h2 id="configuration-details-title" className="configuration-details-title">
                                        {selectedCategory.name}
                                    </h2>
                                    <p className="configuration-details-description">
                                        {selectedCategory.description || 'Manage sub-categories and their availability.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="modal-close-btn"
                                    onClick={() => setSelectedCategoryId(null)}
                                    aria-label="Close category details"
                                >
                                    <X size={22} />
                                </button>
                            </header>
                            <div className="configuration-details-body">
                                <div className="configuration-details-toolbar">
                                    <div className="configuration-subcategory-heading">
                                        Sub-categories
                                        <span>{selectedCategory.sub_categories?.length || 0}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openAddModal(selectedCategory.id)}
                                        className="configuration-action-add"
                                    >
                                        <Plus size={16} /> Add sub-category
                                    </button>
                                </div>
                                {selectedCategory.sub_categories?.length ? (
                                    <div className="configuration-details-list">
                                        {selectedCategory.sub_categories.map((sub) => (
                                            <SubcategoryItem
                                                key={sub.id}
                                                sub={sub}
                                                onUpdate={(data) => updateMutation.mutate({ id: sub.id, data })}
                                                onEdit={() => openEditModal({ ...sub, parent_id: selectedCategory.id })}
                                                onDelete={() => handleDelete({ ...sub, parent_id: selectedCategory.id })}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="configuration-details-empty">
                                        <FolderTree size={28} />
                                        <p>No sub-categories yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                );
            })()}
        </div>
    );
};

const HeaderItem = ({ header, onOpen, onEdit, onUpdate, onDelete }) => {
    return (
        <article
            className={`configuration-category-card ${header.is_active ? '' : 'is-inactive'}`}
            onClick={onOpen}
        >
            <div className="configuration-category-card-header">
                <button
                    type="button"
                    className="configuration-category-identity"
                    onClick={(event) => { event.stopPropagation(); onOpen(); }}
                    aria-label={`Open ${header.name} category details`}
                >
                    <span className="configuration-category-icon"><FolderTree size={20} /></span>
                    <span className="configuration-category-identity-copy">
                        <span className="configuration-category-name">{header.name}</span>
                        <span className="configuration-category-subcount">
                            {header.sub_categories?.length || 0} sub-categories
                        </span>
                    </span>
                </button>
                <ToggleSwitch
                    checked={Boolean(header.is_active)}
                    onChange={(checked) => onUpdate(header.id, { is_active: checked })}
                    label={header.is_active ? 'Active' : 'Inactive'}
                    ariaLabel={`${header.is_active ? 'Deactivate' : 'Activate'} ${header.name}`}
                />
            </div>
            {header.description && <p className="configuration-category-description">{header.description}</p>}
            <div className="configuration-category-actions">
                <div className="configuration-icon-actions">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label={`Edit ${header.name}`} title="Edit category"><Edit size={17} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label={`Delete ${header.name}`} title="Delete category"><Trash2 size={17} /></button>
                </div>
            </div>
        </article>
    );
};

const SubcategoryItem = ({ sub, onUpdate, onEdit, onDelete }) => (
    <article className={`configuration-subcategory-card ${sub.is_active ? '' : 'is-inactive'}`}>
        <div className="configuration-subcategory-info">
            <span className="configuration-subcategory-name">{sub.name}</span>
            {sub.description && <span className="configuration-subcategory-description">{sub.description}</span>}
            <span className={`configuration-status ${sub.is_active ? 'is-active' : ''}`}>
                {sub.is_active ? 'Active' : 'Inactive'}
            </span>
        </div>
        <div className="configuration-subcategory-controls">
            <ToggleSwitch
                checked={Boolean(sub.is_active)}
                onChange={(checked) => onUpdate({ is_active: checked })}
                ariaLabel={`${sub.is_active ? 'Deactivate' : 'Activate'} ${sub.name}`}
            />
            <div className="configuration-icon-actions">
                <button type="button" onClick={onEdit} aria-label={`Edit ${sub.name}`} title="Edit sub-category"><Edit size={16} /></button>
                <button type="button" onClick={onDelete} aria-label={`Delete ${sub.name}`} title="Delete sub-category"><Trash2 size={16} /></button>
            </div>
        </div>
    </article>
);

export default TicketConfiguration;
