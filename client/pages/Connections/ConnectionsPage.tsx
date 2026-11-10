import { useCallback, useEffect, useRef, useState } from 'react';
import { TierBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';
import {
    addConnection,
    connectionsExportUrl,
    deleteConnection,
    importConnections,
    loadEnvironments,
    reorderConnections,
    testConnectionDraft,
    updateConnection
} from '@/services/apiService';
import type { RedisConnection } from '@/types';
import { ConnectionForm, type TestResult } from './ConnectionForm';
import {
    blankDraft,
    draftFromConnection,
    draftToPayload,
    moveItem,
    type ConnectionDraft
} from './connectionDraft';

function guardLabel(c: RedisConnection): string {
    if (c.readOnly) return 'Read-only';
    if (c.confirmWrites) return 'Confirm writes';
    return '—';
}

export function ConnectionsPage() {
    const [connections, setConnections] = useState<RedisConnection[]>([]);
    const [draft, setDraft] = useState<ConnectionDraft | null>(null);
    const [errors, setErrors] = useState<{ id?: string; host?: string }>({});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [includePasswords, setIncludePasswords] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const currentEnvironment = useAppStore((s) => s.currentEnvironment);
    const setGlobalConnections = useAppStore((s) => s.setConnections);
    const setCurrentEnvironment = useAppStore((s) => s.setCurrentEnvironment);

    const refresh = useCallback(async () => {
        try {
            const list = await loadEnvironments();
            setConnections(list);
            setGlobalConnections(list);
            if (
                currentEnvironment &&
                !list.some((c) => c.id === currentEnvironment)
            ) {
                setCurrentEnvironment(list[0]?.id ?? '');
            }
        } catch (error) {
            showToast('Error loading connections', 'error');
            console.error(error);
        }
    }, [
        currentEnvironment,
        setCurrentEnvironment,
        setGlobalConnections,
        showToast
    ]);

    useEffect(() => {
        let cancelled = false;
        void loadEnvironments().then((list) => {
            if (!cancelled) setConnections(list);
        }, console.error);
        return () => {
            cancelled = true;
        };
    }, []);

    const openDraft = (d: ConnectionDraft) => {
        setDraft(d);
        setErrors({});
        setTestResult(null);
    };

    const handleChange = (next: ConnectionDraft) => {
        setDraft(next);
        setTestResult(null);
    };

    const handleSave = async () => {
        if (!draft) return;
        const nextErrors: { id?: string; host?: string } = {};
        const name = draft.id.trim();
        if (!name) nextErrors.id = 'Give the connection a name';
        else if (draft.isNew && connections.some((c) => c.id === name))
            nextErrors.id = 'A connection with this name already exists';
        if (!draft.host.trim()) nextErrors.host = 'Enter a host';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        try {
            const payload = draftToPayload(draft);
            if (draft.isNew) await addConnection(payload);
            else await updateConnection(payload);
            showToast(
                draft.isNew ? 'Connection added' : 'Connection updated',
                'success'
            );
            setDraft(null);
            await refresh();
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : 'Error saving connection',
                'error'
            );
        }
    };

    const handleTest = async () => {
        if (!draft) return;
        if (!draft.host.trim()) {
            setErrors({ host: 'Enter a host' });
            return;
        }
        setTesting(true);
        const payload = draftToPayload(draft);
        const result = await testConnectionDraft(
            draft.isNew ? { ...payload, id: '' } : payload
        );
        setTestResult(result);
        setTesting(false);
    };

    const handleDelete = async () => {
        if (!draft || draft.isNew) return;
        if (!window.confirm(`Delete connection "${draft.id}"?`)) return;
        try {
            await deleteConnection(draft.id);
            showToast('Connection deleted', 'success');
            setDraft(null);
            await refresh();
        } catch (error) {
            showToast('Error deleting connection', 'error');
            console.error(error);
        }
    };

    const handleDrop = async (to: number) => {
        if (dragIndex === null || dragIndex === to) return;
        const next = moveItem(connections, dragIndex, to);
        setDragIndex(null);
        setConnections(next);
        try {
            await reorderConnections(next.map((c) => c.id));
            setGlobalConnections(next);
        } catch (error) {
            showToast('Error saving order', 'error');
            console.error(error);
            await refresh();
        }
    };

    const handleImport = async (file: File) => {
        try {
            const parsed = JSON.parse(await file.text()) as
                { connections?: unknown[] } | unknown[];
            const list = Array.isArray(parsed) ? parsed : parsed.connections;
            if (!Array.isArray(list)) throw new Error('No connections array');
            const result = await importConnections(list);
            showToast(
                `Imported ${String(result.imported)}, ${String(result.errors)} errors`,
                result.errors ? 'error' : 'success'
            );
            await refresh();
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Import failed',
                'error'
            );
        }
    };

    return (
        <div className={`cwrap ${draft ? '' : 'nodrawer'}`}>
            <section className="cmain">
                <div className="viewhead">
                    <div className="cmain-title">
                        <h1>Connections</h1>
                        <span className="sm mu">
                            {connections.length} servers
                        </span>
                    </div>
                    <label className="sm mu cexport-opt">
                        <input
                            type="checkbox"
                            checked={includePasswords}
                            onChange={(e) =>
                                setIncludePasswords(e.target.checked)
                            }
                        />
                        Include passwords
                    </label>
                    <a
                        className="btn"
                        href={connectionsExportUrl(includePasswords)}
                        download="redis-connections.json"
                    >
                        Export
                    </a>
                    <Button onClick={() => importRef.current?.click()}>
                        Import
                    </Button>
                    <input
                        ref={importRef}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        data-testid="import-input"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void handleImport(file);
                        }}
                    />
                    <Button
                        variant="primary"
                        onClick={() => openDraft(blankDraft())}
                    >
                        Add connection
                    </Button>
                </div>
                <div className="scroll cscroll">
                    <div className="ctable-wrap">
                        <table className="ctable">
                            <thead>
                                <tr>
                                    <th scope="col" aria-label="Reorder" />
                                    <th scope="col">Name</th>
                                    <th scope="col">Address</th>
                                    <th scope="col">DB</th>
                                    <th scope="col">Guard</th>
                                </tr>
                            </thead>
                            <tbody>
                                {connections.map((c, i) => (
                                    <tr
                                        key={c.id}
                                        data-testid="conn-row"
                                        className={`row ${draft?.id === c.id && !draft.isNew ? 'on' : ''} ${dragIndex === i ? 'dragging' : ''}`}
                                        draggable
                                        tabIndex={0}
                                        onClick={() =>
                                            openDraft(draftFromConnection(c))
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                                openDraft(
                                                    draftFromConnection(c)
                                                );
                                        }}
                                        onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed =
                                                'move';
                                            e.dataTransfer.setData(
                                                'text/plain',
                                                c.id
                                            );
                                            setDragIndex(i);
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            void handleDrop(i);
                                        }}
                                        onDragEnd={() => setDragIndex(null)}
                                    >
                                        <td
                                            className="drag-handle"
                                            aria-hidden="true"
                                        >
                                            ⋮⋮
                                        </td>
                                        <td>
                                            <span className="cname">
                                                <TierBadge
                                                    tier={c.tier ?? 'local'}
                                                />
                                                {c.id}
                                            </span>
                                        </td>
                                        <td className="mono tx2">
                                            {c.host + ':' + String(c.port)}
                                            {c.tls && (
                                                <span className="kind">
                                                    {' '}
                                                    TLS
                                                </span>
                                            )}
                                        </td>
                                        <td className="mono tx2">
                                            {c.db ?? 0}
                                        </td>
                                        <td className="tx2">{guardLabel(c)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            {draft && (
                <ConnectionForm
                    key={draft.isNew ? '__new__' : draft.id}
                    draft={draft}
                    errors={errors}
                    testing={testing}
                    testResult={testResult}
                    onChange={handleChange}
                    onTest={() => void handleTest()}
                    onSave={() => void handleSave()}
                    onDelete={() => void handleDelete()}
                    onClose={() => setDraft(null)}
                />
            )}
        </div>
    );
}
