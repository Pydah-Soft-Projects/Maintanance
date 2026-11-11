import React from 'react';
import { Check } from 'lucide-react';

const TicketStepper = ({ status }) => {
    const steps = [
        { label: 'Submitted', value: 'pending' },
        { label: 'Assigned', value: 'approaching' },
        { label: 'In Progress', value: 'resolving' },
        { label: 'Resolved', value: 'completed' }
    ];

    if (status === 'rejected') {
        return (
            <div className="ticket-progress-rejected" role="status">
                Complaint rejected
            </div>
        );
    }

    const matchedStepIndex = steps.findIndex((step) => step.value === status);
    const currentStepIndex = matchedStepIndex === -1
        ? (status === 'closed' ? steps.length - 1 : 0)
        : matchedStepIndex;

    return (
        <ol className="ticket-progress" aria-label="Complaint progress">
            {steps.map((step, index) => {
                const isComplete = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <li
                        key={step.value}
                        className={`ticket-progress-step${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`}
                        aria-current={isCurrent ? 'step' : undefined}
                    >
                        {index < steps.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={`ticket-progress-connector${index < currentStepIndex ? ' is-complete' : ''}`}
                            />
                        )}
                        <span className="ticket-progress-marker">
                            {isComplete ? <Check size={14} strokeWidth={2.5} /> : index + 1}
                        </span>
                        <span className="ticket-progress-label">{step.label}</span>
                        {isCurrent && <span className="ticket-progress-current">Current</span>}
                    </li>
                );
            })}
        </ol>
    );
};

export default TicketStepper;
