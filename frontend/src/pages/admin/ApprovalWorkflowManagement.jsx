import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Plus, Search, Trash2, Users } from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const ApprovalWorkflowManagement = () => {
    const queryClient = useQueryClient();
    const activeTab = 'flows';
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [groupForm, setGroupForm] = useState({ member_type: 'worker', service_type: '' });
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [scopeType, setScopeType] = useState('default');
    const [categoryId, setCategoryId] = useState('');
    const [flowName, setFlowName] = useState('Default approval flow');
    const [stages, setStages] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const { data: config, isLoading, isError } = useQuery({
        queryKey: ['approval-workflow-config'],
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async () => {
            const response = await api.get('/approval-workflows');
            return response.data?.data;
        }
    });

    const { data: employees = [], isError: employeesError } = useQuery({
        queryKey: ['ticket-employees'],
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async () => {
            const response = await api.get('/employees');
            return response.data?.data || [];
        }
    });

    const groups = useMemo(() => config?.groups || [], [config?.groups]);
    const workflows = useMemo(() => config?.workflows || [], [config?.workflows]);
    const categories = useMemo(() => config?.categories || [], [config?.categories]);
    const selectedCategoryId = categoryId || String(categories[0]?.id || '');
    const approverRoles = ['manager', 'worker', 'sub_admin', 'super_admin'].map((memberType) => ({
        memberType,
        memberCount: Number(config?.approver_counts?.[memberType] || 0)
    }));
    const approverRoleLabels = {
        manager: 'Manager',
        worker: 'Worker',
        sub_admin: 'Sub-admin',
        super_admin: 'Superadmin'
    };
    const filteredGroups = groups;
    const selectedGroup = groups.find((group) => Number(group.id) === Number(selectedGroupId)) || null;
    const groupBeingEdited = groups.find((group) => Number(group.id) === Number(editingGroupId)) || null;
    const selectedWorkflow = workflows.find((workflow) =>
        workflow.scope_type === scopeType &&
        (scopeType === 'default'
            ? workflow.category_id === null || workflow.category_id === undefined
            : Number(workflow.category_id) === Number(selectedCategoryId))
    );
    const hasDefaultWorkflow = workflows.some((workflow) => workflow.scope_type === 'default');
    const availableCategories = categories.filter((category) => !workflows.some((workflow) =>
        workflow.scope_type === 'category' && Number(workflow.category_id) === Number(category.id)
    ));
    const canCreateFlow = !hasDefaultWorkflow || availableCategories.length > 0;
    const beginEditFlow = (workflow) => {
        setScopeType(workflow.scope_type);
        setCategoryId(workflow.category_id == null ? '' : String(workflow.category_id));
        setFlowName(workflow.name);
        setStages(workflow.stages.map((stage) => ({
            stage_name: stage.stage_name,
            member_type: stage.member_type
        })));
        setIsCreating(false);
        setIsEditing(true);
    };
    const beginCreateFlow = () => {
        if (!hasDefaultWorkflow) {
            setScopeType('default');
            setCategoryId('');
            setFlowName('Default approval flow');
        } else if (availableCategories.length) {
            setScopeType('category');
            setCategoryId(String(availableCategories[0].id));
            setFlowName(`${availableCategories[0].name} approval flow`);
        }
        setStages([]);
        setIsCreating(true);
        setIsEditing(true);
    };
    const eligibleEmployees = useMemo(() => employees.filter((employee) =>
        employee.is_active !== 0 && employee.role === 'worker'
    ), [employees]);
    const searchableEmployees = eligibleEmployees.filter((employee) => {
        const query = memberSearch.trim().toLowerCase();
        return query && [
            employee.name,
            employee.username,
            employee.email,
            employee.phone,
            employee.hrms_id,
            employee.role_display_name,
            employee.role
        ].some((value) => String(value || '').toLowerCase().includes(query));
    });
    const candidateEmployees = selectedGroup
        ? searchableEmployees.filter((employee) =>
            !selectedGroup.members.some((member) => Number(member.id) === Number(employee.id))
        ).slice(0, 8)
        : [];

    useEffect(() => {
        if (!config) return;
        const workflow = workflows.find((item) =>
            item.scope_type === scopeType &&
            (scopeType === 'default'
                ? item.category_id === null || item.category_id === undefined
                : Number(item.category_id) === Number(selectedCategoryId))
        );
        startTransition(() => {
            setFlowName(workflow?.name || (
                scopeType === 'default'
                    ? 'Default approval flow'
                    : `${categories.find((category) => Number(category.id) === Number(selectedCategoryId))?.name || 'Category'} approval flow`
            ));
            setStages(workflow?.stages?.map((stage) => ({
                stage_name: stage.stage_name,
                member_type: stage.member_type
            })) || []);
        });
    }, [config, selectedWorkflow, scopeType, selectedCategoryId, categories, workflows]);

    const refreshConfig = () => queryClient.invalidateQueries({ queryKey: ['approval-workflow-config'] });
    const groupMutation = useMutation({
        mutationFn: async () => {
            const currentMembers = groupBeingEdited?.members.map((member) => member.id) || [];
            const payload = {
                ...groupForm,
                member_ids: currentMembers
            };
            if (editingGroupId) {
                return api.put(`/approval-workflows/groups/${editingGroupId}`, payload);
            }
            return api.post('/approval-workflows/groups', payload);
        },
        onSuccess: async (response) => {
            const createdId = response.data?.data?.id;
            toast.success(editingGroupId ? 'Service group updated' : 'Service group created');
            setGroupForm({ member_type: 'worker', service_type: '' });
            setEditingGroupId(null);
            if (createdId) setSelectedGroupId(createdId);
            await refreshConfig();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to save service group')
    });

    const addMemberMutation = useMutation({
        mutationFn: ({ groupId, userId }) => api.post(`/approval-workflows/groups/${groupId}/members`, { user_id: userId }),
        onSuccess: () => {
            toast.success('Member added');
            setMemberSearch('');
            refreshConfig();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to add member')
    });

    const removeMemberMutation = useMutation({
        mutationFn: ({ groupId, userId }) => api.delete(`/approval-workflows/groups/${groupId}/members/${userId}`),
        onSuccess: () => {
            toast.success('Member removed');
            refreshConfig();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to remove member')
    });

    const deleteGroupMutation = useMutation({
        mutationFn: (groupId) => api.delete(`/approval-workflows/groups/${groupId}`),
        onSuccess: () => {
            toast.success('Service group deleted');
            setSelectedGroupId(null);
            refreshConfig();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to delete service group')
    });

    const saveWorkflowMutation = useMutation({
        mutationFn: () => api.put('/approval-workflows/workflows', {
            scope_type: scopeType,
            category_id: scopeType === 'category' ? Number(selectedCategoryId) : null,
            name: flowName.trim(),
            stages: stages.map((stage) => ({
                stage_name: stage.stage_name.trim(),
                member_type: stage.member_type
            }))
        }),
        onSuccess: async () => {
            toast.success('Approval flow saved');
            await refreshConfig();
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            setIsEditing(false);
            setIsCreating(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || error.message || 'Unable to save approval flow')
    });

    const deleteWorkflowMutation = useMutation({
        mutationFn: () => api.delete('/approval-workflows/workflows', {
            data: {
                scope_type: scopeType,
                category_id: scopeType === 'category' ? Number(selectedCategoryId) : null
            }
        }),
        onSuccess: async () => {
            toast.success('Approval flow removed');
            await refreshConfig();
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            setIsEditing(false);
            setIsCreating(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to remove approval flow')
    });

    const startEditingGroup = (group) => {
        setSelectedGroupId(group.id);
        setEditingGroupId(group.id);
        setGroupForm({ member_type: group.member_type, service_type: group.service_type });
    };

    const moveStage = (index, direction) => {
        const destination = index + direction;
        if (destination < 0 || destination >= stages.length) return;
        setStages((current) => {
            const reordered = [...current];
            [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
            return reordered;
        });
    };

    const addStage = () => {
        if (stages.length >= 20) {
            toast.error('An approval flow can have at most 20 stages');
            return;
        }
        setStages((current) => [...current, {
            stage_name: `Approval stage ${current.length + 1}`,
            member_type: approverRoles[0].memberType
        }]);
    };

    if (isLoading) {
        return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading approval setup...</div>;
    }

    if (isError) {
        return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load approval settings.</div>;
    }

    return (
        <section className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Approval setup</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Managers can approve across service types; Workers are organized by their service type.
                    </p>
                </div>
            </div>

            {activeTab === 'groups' ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-bold text-slate-900">Worker service types</h3>
                            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">Worker</span>
                        </div>

                        <form
                            className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[1fr_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (!groupForm.service_type.trim()) return toast.error('Enter a service type');
                                groupMutation.mutate();
                            }}
                        >
                            <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                Worker service type
                                <input
                                    value={groupForm.service_type}
                                    onChange={(event) => setGroupForm({ ...groupForm, service_type: event.target.value })}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                    placeholder="Plumbing, Electricity..."
                                    maxLength={100}
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={groupMutation.isPending}
                                className="inline-flex items-center justify-center gap-1 self-end rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {editingGroupId ? <Check size={15} /> : <Plus size={15} />}
                                {editingGroupId ? 'Save' : 'Create'}
                            </button>
                        </form>

                        {editingGroupId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingGroupId(null);
                                    setGroupForm({ member_type: 'worker', service_type: '' });
                                }}
                                className="text-xs font-semibold text-slate-600"
                            >
                                Cancel editing
                            </button>
                        )}

                        <div className="space-y-2">
                            {filteredGroups.map((group) => (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${Number(selectedGroupId) === Number(group.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                                >
                                    <span className="font-semibold text-slate-800">{group.service_type}</span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                        {group.members.length} members
                                    </span>
                                </button>
                            ))}
                            {filteredGroups.length === 0 && (
                                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                                    No worker service types yet.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                        {selectedGroup ? (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{selectedGroup.member_type}</p>
                                        <h3 className="text-lg font-bold text-slate-900">{selectedGroup.service_type}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEditingGroup(selectedGroup)}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                                        >
                                            Edit group
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm(`Delete the ${selectedGroup.service_type} ${selectedGroup.member_type} group?`)) {
                                                    deleteGroupMutation.mutate(selectedGroup.id);
                                                }
                                            }}
                                            disabled={deleteGroupMutation.isPending}
                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Members</p>
                                    {selectedGroup.members.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                                                <p className="text-xs text-slate-500">{member.username}{member.email ? ` · ${member.email}` : ''}</p>
                                            </div>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${member.name}`}
                                                onClick={() => removeMemberMutation.mutate({ groupId: selectedGroup.id, userId: member.id })}
                                                className="rounded-md p-2 text-red-600"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedGroup.members.length === 0 && <p className="text-sm text-slate-500">No members in this group.</p>}
                                </div>
                                <div className="space-y-3 border-t border-slate-200 pt-4">
                                    {employeesError && (
                                        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                                            Could not load existing app users.
                                        </p>
                                    )}
                                    <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
                                        <Search size={16} className="text-slate-400" />
                                        <input
                                            type="search"
                                            value={memberSearch}
                                            onChange={(event) => setMemberSearch(event.target.value)}
                                            className="w-full border-0 bg-transparent text-sm outline-none"
                                            placeholder="Find an existing app user"
                                        />
                                    </label>
                                    <p className="text-xs text-slate-500">
                                        Only active Workers already registered in the maintenance app can be added.
                                    </p>
                                    {memberSearch.trim() && candidateEmployees.map((employee) => (
                                            <div key={employee.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{employee.name}</p>
                                                    <p className="text-xs text-slate-500">{employee.username} · {employee.role_display_name || employee.role}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addMemberMutation.mutate({ groupId: selectedGroup.id, userId: employee.id })}
                                                    disabled={addMemberMutation.isPending}
                                                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        ))}
                                    {memberSearch.trim() && !employeesError && candidateEmployees.length === 0 && (
                                        <p className="text-xs text-slate-500">No matching unassigned Workers in the app.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
                                <Users size={30} className="mb-3 text-slate-400" />
                                <p className="font-semibold">Select a service group</p>
                                <p className="mt-1 text-sm">Create Worker service types and assign active Workers to them.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : !isEditing ? (
                <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="font-bold text-slate-900">Existing approval flows</h3>
                            <p className="mt-1 text-sm text-slate-600">Review the saved stages. Select Edit flow to make changes.</p>
                        </div>
                        {canCreateFlow && (
                            <button
                                type="button"
                                onClick={beginCreateFlow}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                <Plus size={16} /> Create flow
                            </button>
                        )}
                    </div>
                    {workflows.length ? (
                        <div className="space-y-3">
                            {workflows.map((workflow) => {
                                const categoryName = categories.find((category) =>
                                    Number(category.id) === Number(workflow.category_id)
                                )?.name;
                                return (
                                    <article key={workflow.id} className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <h4 className="font-semibold text-slate-900">{workflow.name}</h4>
                                                <p className="mt-1 text-xs font-medium text-slate-500">
                                                    {workflow.scope_type === 'default'
                                                        ? 'Global default'
                                                        : `${categoryName || 'Category'} override`}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => beginEditFlow(workflow)}
                                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                            >
                                                Edit flow
                                            </button>
                                        </div>
                                        <ol className="mt-4 space-y-2">
                                            {workflow.stages.map((stage, index) => {
                                                const memberCount = Number(config?.approver_counts?.[stage.member_type] || 0);
                                                return (
                                                    <li key={stage.id || `${workflow.id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                        <span className="text-sm text-slate-800">
                                                            <span className="mr-2 font-semibold text-slate-500">{index + 1}.</span>
                                                            {stage.stage_name}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-600">
                                                            {approverRoleLabels[stage.member_type] || stage.member_type}
                                                            {' · '}
                                                            {stage.member_type === 'worker'
                                                                ? `${memberCount} assigned`
                                                                : `${memberCount} eligible`}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                            {!workflow.stages.length && (
                                                <li className="text-sm text-slate-500">No stages configured.</li>
                                            )}
                                        </ol>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                            No approval flows are configured yet.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-slate-900">{isCreating ? 'Create approval flow' : 'Edit approval flow'}</h3>
                                <p className="mt-1 text-sm text-slate-600">A category override takes precedence over the global default. Stages run in order.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setIsCreating(false);
                                }}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                            Flow scope
                            <select
                                value={scopeType}
                                onChange={(event) => {
                                    const nextScope = event.target.value;
                                    setScopeType(nextScope);
                                    if (nextScope === 'category' && isCreating) {
                                        setCategoryId(String(availableCategories[0]?.id || ''));
                                    } else if (nextScope === 'default') {
                                        setCategoryId('');
                                    }
                                }}
                                disabled={!isCreating}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            >
                                <option value="default" disabled={isCreating && hasDefaultWorkflow}>Global default</option>
                                {(!isCreating || availableCategories.length > 0) && (
                                    <option value="category">Category override</option>
                                )}
                            </select>
                        </label>
                        {scopeType === 'category' && (
                            <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                Complaint category
                                <select
                                    value={selectedCategoryId}
                                    onChange={(event) => setCategoryId(event.target.value)}
                                    disabled={!isCreating}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                >
                                    {(isCreating ? availableCategories : categories).map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <label className="grid max-w-xl gap-1 text-xs font-semibold text-slate-700">
                        Flow name
                        <input
                            value={flowName}
                            onChange={(event) => setFlowName(event.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            maxLength={150}
                        />
                    </label>

                    {selectedWorkflow && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50 px-4 py-3">
                            <p className="text-sm font-semibold text-blue-800">
                                Existing flow · {selectedWorkflow.stages.length} approval {selectedWorkflow.stages.length === 1 ? 'stage' : 'stages'}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    const label = scopeType === 'default' ? 'global default flow' : 'category override';
                                    if (window.confirm(`Remove this ${label}? Existing complaints will keep their current stages.`)) {
                                        deleteWorkflowMutation.mutate();
                                    }
                                }}
                                disabled={deleteWorkflowMutation.isPending}
                                className="text-xs font-semibold text-red-700 disabled:opacity-60"
                            >
                                Remove flow
                            </button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {stages.map((stage, index) => (
                            <div key={`${index}-${stage.member_type}`} className="grid items-end gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[70px_1fr_1fr_auto]">
                                <div className="pb-2 text-sm font-bold text-slate-700">Stage {index + 1}</div>
                                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                    Stage title
                                    <input
                                        value={stage.stage_name}
                                        onChange={(event) => setStages((current) => current.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, stage_name: event.target.value } : item
                                        ))}
                                        placeholder={`Approval stage ${index + 1}`}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        maxLength={150}
                                    />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                                    Approver role
                                    <select
                                        value={stage.member_type}
                                        onChange={(event) => setStages((current) => current.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, member_type: event.target.value } : item
                                        ))}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                    >
                                        <option value="">Select a role</option>
                                        {approverRoles.map(({ memberType, memberCount }) => (
                                            <option key={memberType} value={memberType}>
                                                {approverRoleLabels[memberType]} (
                                                {memberType === 'worker'
                                                    ? `${memberCount} assigned`
                                                    : `${memberCount} eligible`}
                                                )
                                            </option>
                                        ))}
                                    </select>
                                    {approverRoles.find(({ memberType }) => memberType === stage.member_type)?.memberCount === 0 && (
                                        <span className="font-normal text-amber-700">
                                            {stage.member_type === 'worker'
                                                ? 'No Workers are assigned to service types yet. You can save the flow and assign them later.'
                                                : `No eligible ${approverRoleLabels[stage.member_type]} accounts yet. You can save the flow and assign them later.`}
                                        </span>
                                    )}
                                    {stage.member_type === 'worker' && (
                                        <span className="font-normal text-slate-500">
                                            Only Workers assigned to an active service type can approve this stage.
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-1">
                                    <button type="button" aria-label="Move stage up" disabled={index === 0} onClick={() => moveStage(index, -1)} className="rounded-md border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ArrowUp size={16} /></button>
                                    <button type="button" aria-label="Move stage down" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)} className="rounded-md border border-slate-200 p-2 text-slate-600 disabled:opacity-30"><ArrowDown size={16} /></button>
                                    <button type="button" aria-label="Remove stage" onClick={() => setStages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md border border-red-200 p-2 text-red-600"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                        {stages.length === 0 && (
                            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                No stages yet. Add an approval stage to begin the flow.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-between gap-3">
                        <button
                            type="button"
                            onClick={addStage}
                            disabled={stages.length >= 20}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Plus size={16} /> Add stage
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!flowName.trim()) return toast.error('Enter a flow name');
                                if (!stages.length || stages.some((stage) => !stage.member_type)) return toast.error('Choose an approver role for every stage');
                                saveWorkflowMutation.mutate();
                            }}
                            disabled={saveWorkflowMutation.isPending || (scopeType === 'category' && !selectedCategoryId)}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {saveWorkflowMutation.isPending ? 'Saving...' : 'Save approval flow'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">
                        Rejections are terminal. Only the members assigned to the current stage can approve or reject. Changes affect new complaints; existing complaints keep their flow snapshot.
                    </p>
                </div>
            )}
        </section>
    );
};

export default ApprovalWorkflowManagement;
