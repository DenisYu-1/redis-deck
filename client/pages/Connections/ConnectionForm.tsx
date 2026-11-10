import { useState } from 'react';
import type { ConnectionTier } from '@/types';
import { Button } from '@/components/ui/Button';
import type { ConnectionDraft } from './connectionDraft';
import { parseRedisUri } from './uriParser';

export interface TestResult {
    success: boolean;
    message: string;
}

interface Props {
    draft: ConnectionDraft;
    errors: { id?: string; host?: string };
    testing: boolean;
    testResult: TestResult | null;
    onChange: (draft: ConnectionDraft) => void;
    onTest: () => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
}

const TIERS: { value: ConnectionTier; label: string }[] = [
    { value: 'local', label: 'Local' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Production' }
];

type BoolKey = 'tls' | 'verifyTls' | 'cluster' | 'readOnly' | 'confirmWrites';

export function ConnectionForm({
    draft,
    errors,
    testing,
    testResult,
    onChange,
    onTest,
    onSave,
    onDelete,
    onClose
}: Props) {
    const [uri, setUri] = useState('');
    const set = <K extends keyof ConnectionDraft>(
        key: K,
        value: ConnectionDraft[K]
    ) => onChange({ ...draft, [key]: value });

    const handleUri = (value: string) => {
        setUri(value);
        const parsed = parseRedisUri(value);
        if (!parsed) return;
        onChange({
            ...draft,
            tls: parsed.tls,
            username: parsed.username,
            password: parsed.password || draft.password,
            host: parsed.host,
            port: String(parsed.port),
            db: String(parsed.db),
            id:
                draft.id ||
                (draft.isNew
                    ? (parsed.host.split('.')[0] ?? parsed.host)
                    : draft.id)
        });
    };
    const uriInvalid = uri.trim() !== '' && !parseRedisUri(uri);

    const sw = (key: BoolKey, title: string, desc: string) => (
        <label className="sw-row">
            <span className="sw-text">
                <span className="sw-title">{title}</span>
                <span className="sm mu">{desc}</span>
            </span>
            <input
                type="checkbox"
                role="switch"
                aria-label={title}
                checked={draft[key]}
                onChange={(e) => set(key, e.target.checked)}
            />
            <span className="track" aria-hidden="true">
                <i />
            </span>
        </label>
    );

    return (
        <aside
            className="drawer"
            aria-label={draft.isNew ? 'New connection' : 'Edit connection'}
        >
            <div className="drawer-head">
                <h2 className="ellip">
                    {draft.isNew ? 'New connection' : `Edit ${draft.id}`}
                </h2>
                <button
                    type="button"
                    className="iconbtn ghost"
                    aria-label="Close"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>
            <form
                className="dbody"
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave();
                }}
            >
                <label className="field">
                    Connection URI
                    <input
                        className="input mono"
                        type="text"
                        value={uri}
                        placeholder="redis://user:password@host:6379/0"
                        autoComplete="off"
                        onChange={(e) => handleUri(e.target.value)}
                    />
                    {uriInvalid ? (
                        <span className="err">
                            Not a valid redis:// or rediss:// URI
                        </span>
                    ) : (
                        <span className="hint">
                            Paste a URI to fill the fields below.
                        </span>
                    )}
                </label>
                <div className="grid2">
                    <div className="field span2">
                        <label htmlFor="conn-name">Name</label>
                        <input
                            id="conn-name"
                            className={`input ${errors.id ? 'bad' : ''}`}
                            type="text"
                            value={draft.id}
                            readOnly={!draft.isNew}
                            aria-invalid={Boolean(errors.id)}
                            onChange={(e) => set('id', e.target.value)}
                        />
                        {errors.id && <span className="err">{errors.id}</span>}
                    </div>
                    <div className="field span2">
                        <span id="tier-label">Tier</span>
                        <div
                            className="envpick"
                            role="radiogroup"
                            aria-labelledby="tier-label"
                        >
                            {TIERS.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={draft.tier === t.value}
                                    onClick={() => set('tier', t.value)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="conn-host">Host</label>
                        <input
                            id="conn-host"
                            className={`input mono ${errors.host ? 'bad' : ''}`}
                            type="text"
                            value={draft.host}
                            aria-invalid={Boolean(errors.host)}
                            onChange={(e) => set('host', e.target.value)}
                        />
                        {errors.host && (
                            <span className="err">{errors.host}</span>
                        )}
                    </div>
                    <div className="grid2">
                        <label className="field">
                            Port
                            <input
                                className="input mono"
                                type="text"
                                inputMode="numeric"
                                value={draft.port}
                                onChange={(e) => set('port', e.target.value)}
                            />
                        </label>
                        <label className="field">
                            DB
                            <input
                                className="input mono"
                                type="text"
                                inputMode="numeric"
                                value={draft.db}
                                onChange={(e) => set('db', e.target.value)}
                            />
                        </label>
                    </div>
                    <label className="field">
                        ACL user
                        <input
                            className="input mono"
                            type="text"
                            value={draft.username}
                            placeholder="default"
                            autoComplete="off"
                            onChange={(e) => set('username', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        Password
                        <input
                            className="input"
                            type="password"
                            value={draft.password}
                            placeholder={
                                draft.hasPassword ? '•••••••• (unchanged)' : ''
                            }
                            autoComplete="new-password"
                            onChange={(e) => set('password', e.target.value)}
                        />
                    </label>
                </div>
                <fieldset className="sw-group">
                    <legend className="label">Transport</legend>
                    {sw('tls', 'TLS', 'rediss:// — encrypt the connection')}
                    {sw(
                        'verifyTls',
                        'Verify certificate',
                        'Reject self-signed or mismatched certificates'
                    )}
                    {sw(
                        'cluster',
                        'Cluster mode',
                        'Follow MOVED redirects across shards'
                    )}
                </fieldset>
                <fieldset className="sw-group">
                    <legend className="label">Safety</legend>
                    {sw(
                        'readOnly',
                        'Read-only',
                        'Server refuses writes and deletes'
                    )}
                    {sw(
                        'confirmWrites',
                        'Confirm writes',
                        'Type the connection name before each write'
                    )}
                </fieldset>
                {testResult && (
                    <div
                        className={`callout ${testResult.success ? 'ok' : 'err'}`}
                        role="status"
                    >
                        {testResult.message}
                    </div>
                )}
            </form>
            <div className="drawer-foot">
                {!draft.isNew && (
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={onDelete}
                        aria-label="Delete connection"
                    >
                        Delete connection
                    </Button>
                )}
                <span className="grow" />
                <Button size="sm" onClick={onTest} disabled={testing}>
                    {testing && <span className="spin" />}Test
                </Button>
                <Button size="sm" variant="primary" onClick={onSave}>
                    Save
                </Button>
            </div>
        </aside>
    );
}
