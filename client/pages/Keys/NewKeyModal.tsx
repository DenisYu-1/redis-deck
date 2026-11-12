import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { saveKey } from '@/services/apiService';
import { showToast } from '@/utils/toast';
import { parseNewValue, parseTtlInput } from './writeInputs';

const TYPES = ['string', 'hash', 'list', 'set', 'zset'] as const;

const VALUE_HINT: Record<string, string> = {
    string: 'The value.',
    hash: 'One field=value per line.',
    list: 'One item per line.',
    set: 'One member per line.',
    zset: 'One "score member" per line.'
};

interface Props {
    env: string;
    onClose: () => void;
    /** Called with the created key's name. */
    onCreated: (key: string) => void;
}

/** "New key" dialog (replaces the old add-key panel). */
export function NewKeyModal({ env, onClose, onCreated }: Props) {
    const [name, setName] = useState('');
    const [type, setType] = useState<string>('string');
    const [text, setText] = useState('');
    const [ttl, setTtl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!name.trim()) return setError('Key name is required');
        const parsed = parseNewValue(type, text);
        if ('error' in parsed) return setError(parsed.error);
        const seconds = parseTtlInput(ttl);
        if (seconds === null) {
            return setError('Invalid TTL: use seconds, 5m, 2h or 1d');
        }
        setBusy(true);
        setError(null);
        try {
            await saveKey(
                name,
                parsed.value,
                seconds > 0 ? seconds : null,
                env,
                type
            );
            showToast(`Created ${name}`, 'success');
            onCreated(name);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title="New key"
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() => void submit()}
                    >
                        Create
                    </Button>
                </>
            }
        >
            <form onSubmit={(e) => void submit(e)}>
                <div className="field">
                    <label htmlFor="nk-name">Key name</label>
                    <input
                        id="nk-name"
                        className="input mono"
                        autoFocus
                        autoComplete="off"
                        placeholder="namespace:id"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="field">
                    <label htmlFor="nk-type">Type</label>
                    <select
                        id="nk-type"
                        className="select"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        {TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="nk-value">Value</label>
                    <textarea
                        id="nk-value"
                        className="textarea mono"
                        rows={5}
                        style={{ height: 'auto', padding: 10 }}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <span className="hint">{VALUE_HINT[type]}</span>
                </div>
                <div className="field">
                    <label htmlFor="nk-ttl">TTL</label>
                    <input
                        id="nk-ttl"
                        className="input mono"
                        autoComplete="off"
                        placeholder="none"
                        value={ttl}
                        onChange={(e) => setTtl(e.target.value)}
                    />
                    <span className="hint">
                        Seconds, or 5m / 2h / 1d. Blank means no expiry.
                    </span>
                </div>
                {error && (
                    <div className="err" role="alert">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
}
