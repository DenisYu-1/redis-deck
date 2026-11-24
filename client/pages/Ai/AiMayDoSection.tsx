import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { getAiHiddenFields, setAiHiddenFields } from '@/services/apiService';

/** "What AI clients may do": the fields whose values AI clients never see. */
export function AiMayDoSection() {
    const [fields, setFields] = useState<string[] | null>(null);
    const [draft, setDraft] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getAiHiddenFields().then(
            (f) => {
                if (!cancelled) setFields(f);
            },
            (e: Error) => showToast(`Hidden fields: ${e.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const save = async (next: string[]) => {
        try {
            setFields(await setAiHiddenFields(next));
            return true;
        } catch (e) {
            showToast((e as Error).message, 'error');
            return false;
        }
    };

    const add = async () => {
        const name = draft.trim().toLowerCase();
        if (!name || !fields) return;
        if (fields.includes(name)) {
            showToast(`"${name}" is already hidden`, 'error');
            return;
        }
        if (await save([...fields, name])) setDraft('');
    };

    return (
        <section className="card sect" aria-label="Hidden fields">
            <div className="cmain-title">
                <h2>Hidden fields</h2>
                <span className="sm mu">
                    AI clients see ●●● instead of these values (hash fields and
                    JSON keys, any case)
                </span>
            </div>
            <div className="hfchips">
                {(fields ?? []).map((f) => (
                    <span key={f} className="hfchip">
                        {f}
                        <button
                            type="button"
                            aria-label={`Remove ${f}`}
                            onClick={() =>
                                void save((fields ?? []).filter((x) => x !== f))
                            }
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <form
                className="hfadd"
                onSubmit={(e) => {
                    e.preventDefault();
                    void add();
                }}
            >
                <input
                    className="input mono"
                    aria-label="Field name"
                    placeholder="field name"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <Button type="submit" disabled={!draft.trim() || !fields}>
                    Add
                </Button>
            </form>
        </section>
    );
}
