import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../config/api';

const ROLE_TYPES = [{ value: 'worker', label: 'Worker' }];

const ApprovalRoleTypes = ({ canManage }) => {
    const queryClient = useQueryClient();
    const [serviceType, setServiceType] = useState('');
    const { data: config, isLoading, isError } = useQuery({
        queryKey: ['approval-workflow-config'],
        queryFn: async () => {
            const response = await api.get('/approval-workflows');
            return response.data?.data || {};
        }
    });
    const groups = Array.isArray(config?.groups) ? config.groups : [];

    const refreshGroups = () => queryClient.invalidateQueries({ queryKey: ['approval-workflow-config'] });
    const addTypeMutation = useMutation({
        mutationFn: ({ memberType, serviceType }) => api.post('/approval-workflows/groups', {
            member_type: memberType,
            service_type: serviceType,
            member_ids: []
        }),
        onSuccess: (_response, variables) => {
            setServiceType('');
            toast.success(`${variables.serviceType} added under ${variables.memberType}`);
            refreshGroups();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to add service type')
    });
    const removeTypeMutation = useMutation({
        mutationFn: (groupId) => api.delete(`/approval-workflows/groups/${groupId}`),
        onSuccess: () => {
            toast.success('Service type removed');
            refreshGroups();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Unable to remove service type')
    });

    return (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">Worker service types</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Add service types for Workers. Managers can view complaints across every service type.
                </p>
            </div>

            {isLoading ? (
                <p className="text-sm text-slate-500">Loading role types...</p>
            ) : isError ? (
                <p className="text-sm text-red-600">Could not load role types.</p>
            ) : (
                <div className="grid gap-4">
                    {ROLE_TYPES.map(({ value, label }) => {
                        const roleGroups = groups.filter((group) => group.member_type === value);
                        return (
                            <div key={value} className="rounded-lg border border-slate-200 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">{label}</h3>
                                    <span className="text-xs text-slate-500">{roleGroups.length} types</span>
                                </div>

                                <div className="mb-4 flex flex-wrap gap-2">
                                    {roleGroups.map((group) => (
                                        <span key={group.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                                            {group.service_type}
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${group.service_type} from ${label}`}
                                                    title="Remove service type"
                                                    disabled={removeTypeMutation.isPending}
                                                    onClick={() => {
                                                        if (window.confirm(`Remove ${group.service_type} from ${label}?`)) {
                                                            removeTypeMutation.mutate(group.id);
                                                        }
                                                    }}
                                                    className="rounded p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {roleGroups.length === 0 && (
                                        <p className="text-sm text-slate-500">No service types configured.</p>
                                    )}
                                </div>

                                {canManage && (
                                    <form
                                        className="flex gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const trimmedServiceType = serviceType.trim();
                                            if (!trimmedServiceType) return;
                                            addTypeMutation.mutate({ memberType: value, serviceType: trimmedServiceType });
                                        }}
                                    >
                                        <input
                                            value={serviceType}
                                            onChange={(event) => setServiceType(event.target.value)}
                                            maxLength={100}
                                            placeholder={`Add ${label.toLowerCase()} type`}
                                            aria-label={`Add ${label.toLowerCase()} service type`}
                                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!serviceType.trim() || addTypeMutation.isPending}
                                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                        >
                                            <Plus size={15} /> Add
                                        </button>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default ApprovalRoleTypes;
