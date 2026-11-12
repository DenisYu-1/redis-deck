import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface FormField {
    name: string;
    label: string;
    initial?: string;
    placeholder?: string;
    hint?: string;
    multiline?: boolean;
    mono?: boolean;
}

interface Props {
    title: string;
    submitLabel: string;
    fields?: FormField[];
    /** Text shown above the fields (used by confirmation-only dialogs). */
    message?: string;
    danger?: boolean;
    onClose: () => void;
    /** Return an error message to keep the dialog open, or nothing to close it. */
    onSubmit: (values: Record<string, string>) => Promise<string | undefined>;
}

/** A small form dialog on the Modal primitive: fields, error line, submit. */
export function FormModal({
    title,
    submitLabel,
    fields = [],
    message,
    danger,
    onClose,
    onSubmit
}: Props) {
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map((f) => [f.name, f.initial ?? '']))
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e?: FormEvent) => {
        e?.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const problem = await onSubmit(values);
            if (problem) {
                setError(problem);
                return;
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        variant={danger ? 'danger' : 'primary'}
                        disabled={busy}
                        onClick={() => void submit()}
                    >
                        {submitLabel}
                    </Button>
                </>
            }
        >
            <form onSubmit={(e) => void submit(e)}>
                {message && <p className="sm mu">{message}</p>}
                {fields.map((f, i) => {
                    const common = {
                        id: `fm-${f.name}`,
                        value: values[f.name] ?? '',
                        placeholder: f.placeholder,
                        autoFocus: i === 0,
                        autoComplete: 'off',
                        spellCheck: false,
                        onChange: (
                            ev: React.ChangeEvent<
                                HTMLInputElement | HTMLTextAreaElement
                            >
                        ) =>
                            setValues((v) => ({
                                ...v,
                                [f.name]: ev.target.value
                            }))
                    };
                    return (
                        <div className="field" key={f.name}>
                            <label htmlFor={common.id}>{f.label}</label>
                            {f.multiline ? (
                                <textarea
                                    {...common}
                                    rows={6}
                                    className={`textarea${f.mono ? ' mono' : ''}`}
                                    style={{ height: 'auto', padding: 10 }}
                                />
                            ) : (
                                <input
                                    {...common}
                                    className={`input${f.mono ? ' mono' : ''}`}
                                />
                            )}
                            {f.hint && <span className="hint">{f.hint}</span>}
                        </div>
                    );
                })}
                {error && (
                    <div className="err" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
}
