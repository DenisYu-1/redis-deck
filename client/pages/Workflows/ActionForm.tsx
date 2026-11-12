import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import type { WorkflowAction } from '@/types/workflows';

interface ActionFormProps {
    action: WorkflowAction;
    values: Record<string, string>;
    errors: Record<string, string>;
    busy: boolean;
    blockedReason: string | null;
    onChange: (name: string, value: string) => void;
    onPlan: () => void;
    onRun: () => void;
}

export function ActionForm({
    action,
    values,
    errors,
    busy,
    blockedReason,
    onChange,
    onPlan,
    onRun
}: ActionFormProps) {
    const submit = (e: FormEvent) => {
        e.preventDefault();
        onRun();
    };
    return (
        <form
            onSubmit={submit}
            className="card wf-form"
            aria-label={action.title}
        >
            {action.inputs.map((input) => {
                const id = `wf-${action.id}-${input.name}`;
                const label = input.label ?? input.name;
                return (
                    <div className="field" key={input.name}>
                        <label htmlFor={id}>
                            {label}
                            {input.required ? ' *' : ''}
                        </label>
                        {input.type === 'select' ? (
                            <select
                                id={id}
                                className="select"
                                value={values[input.name] ?? ''}
                                onChange={(e) =>
                                    onChange(input.name, e.target.value)
                                }
                            >
                                {!input.required && <option value="">-</option>}
                                {(input.options ?? []).map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label ?? o.value}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                id={id}
                                className={`input mono ${errors[input.name] ? 'bad' : ''}`}
                                value={values[input.name] ?? ''}
                                placeholder={input.placeholder}
                                inputMode={
                                    input.type === 'int' ? 'numeric' : undefined
                                }
                                onChange={(e) =>
                                    onChange(input.name, e.target.value)
                                }
                            />
                        )}
                        {errors[input.name] ? (
                            <span className="err" role="alert">
                                {errors[input.name]}
                            </span>
                        ) : (
                            input.hint && (
                                <span className="hint">{input.hint}</span>
                            )
                        )}
                    </div>
                );
            })}
            <div className="wf-actions">
                <Button onClick={onPlan} disabled={busy}>
                    Dry run
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={busy || blockedReason !== null}
                >
                    Run
                </Button>
                {blockedReason && (
                    <span className="err sm" role="status">
                        {blockedReason}
                    </span>
                )}
            </div>
        </form>
    );
}
