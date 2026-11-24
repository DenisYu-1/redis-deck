import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import {
    clearAiActivity,
    getAiActivityLogging,
    listAiActivity,
    listAiActivityClients,
    setAiActivityLogging,
    type AiActivityClient,
    type AiActivityEntry,
    type AiActivityPage,
    type AiActivityResult
} from '@/services/apiService';

const PAGE_SIZE = 25;
const POLL_MS = 5000;
const HIGHLIGHT_MS = 2500;

const STATUSES: { value: '' | AiActivityResult; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'ok', label: 'OK' },
    { value: 'denied', label: 'Denied' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'error', label: 'Error' }
];

/** Pretty-prints stored JSON text; capped responses may not parse, so show them raw. */
function pretty(text: string | null): string {
    if (!text) return '';
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

/** One call; click to see the request and response JSON. */
function ActivityRow({
    entry: e,
    fresh
}: {
    entry: AiActivityEntry;
    fresh: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <tr
                data-testid="ai-activity-row"
                className={`aic-row${fresh ? ' aic-new' : ''}`}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <td className="mono sm">{new Date(e.time).toLocaleString()}</td>
                <td>{e.client}</td>
                <td className="mono sm">{e.operation}</td>
                <td>{e.connectionId}</td>
                <td className="mono sm aic-activity-cell">{e.args ?? ''}</td>
                <td>
                    <span className={`aic-result ${e.result}`}>{e.result}</span>
                    {e.error && <span className="sm mu"> {e.error}</span>}
                </td>
                <td className="sm mu">
                    {e.durationMs === null ? '' : `${e.durationMs} ms`}
                </td>
            </tr>
            {open && (
                <tr data-testid="ai-activity-detail">
                    <td colSpan={7} className="aic-activity-detail mono sm">
                        <strong>Request</strong>
                        <pre>{pretty(e.args)}</pre>
                        <strong>Response</strong>
                        <pre>{pretty(e.response)}</pre>
                    </td>
                </tr>
            )}
        </>
    );
}

/** AI activity log: every call an AI client made, with filters, paging and live refresh. */
export function AiActivityLog() {
    const [text, setText] = useState('');
    const [status, setStatus] = useState<'' | AiActivityResult>('');
    const [client, setClient] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [tick, setTick] = useState(0);
    const [page, setPage] = useState<AiActivityPage | null>(null);
    const [clients, setClients] = useState<AiActivityClient[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [logEnabled, setLogEnabled] = useState<boolean | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
    const seen = useRef<Set<number> | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getAiActivityLogging().then(
            (on) => {
                if (!cancelled) setLogEnabled(on);
            },
            (e: Error) => showToast(`AI activity: ${e.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const toggleLogging = async (on: boolean) => {
        try {
            setLogEnabled(await setAiActivityLogging(on));
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    };

    // Refresh every 5 s while the page is open.
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), POLL_MS);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        listAiActivity({
            q: text,
            status,
            client,
            limit,
            offset: 0
        }).then(
            (p) => {
                if (cancelled) return;
                const known = seen.current;
                const added = known
                    ? p.entries.filter((e) => !known.has(e.id)).map((e) => e.id)
                    : [];
                seen.current = new Set(p.entries.map((e) => e.id));
                if (added.length) {
                    setFresh(new Set(added));
                    timer = setTimeout(() => setFresh(new Set()), HIGHLIGHT_MS);
                }
                setPage(p);
                setError(null);
            },
            (e: Error) => {
                if (!cancelled) setError(e.message);
            }
        );
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [text, status, client, limit, tick]);

    useEffect(() => {
        let cancelled = false;
        listAiActivityClients().then(
            (list) => {
                if (!cancelled) setClients(list);
            },
            () => undefined
        );
        return () => {
            cancelled = true;
        };
    }, [tick]);

    // A filter change starts a new view: nothing in it counts as new.
    const refilter = (change: () => void) => {
        seen.current = null;
        setLimit(PAGE_SIZE);
        change();
    };

    const clear = async () => {
        try {
            await clearAiActivity();
            setConfirmClear(false);
            seen.current = null;
            setTick((t) => t + 1);
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    };

    const entries = page?.entries ?? [];
    const total = page?.total ?? 0;
    const blocked = page?.counts.blocked ?? 0;
    const errors = page?.counts.error ?? 0;

    return (
        <section className="card sect" aria-label="AI activity">
            <div className="sechead">
                <div className="cmain-title">
                    <h2>AI activity</h2>
                    <span className="sm mu">
                        {`${total} calls · ${blocked} blocked · ${errors} errors`}
                    </span>
                </div>
                <span
                    className={`aic-live${logEnabled === false ? ' off' : ''}`}
                >
                    {logEnabled === false ? 'Logging off' : 'Live'}
                </span>
                <label className="aic-log-toggle">
                    <input
                        type="checkbox"
                        checked={logEnabled ?? true}
                        disabled={logEnabled === null}
                        onChange={(e) => void toggleLogging(e.target.checked)}
                    />
                    Log AI operations
                </label>
                <Button
                    disabled={total === 0}
                    onClick={() => setConfirmClear(true)}
                >
                    Clear
                </Button>
            </div>
            <div className="aic-filters">
                <input
                    aria-label="Filter calls"
                    className="input"
                    placeholder="Filter by tool, key or connection"
                    value={text}
                    onChange={(e) => refilter(() => setText(e.target.value))}
                />
                <div role="group" aria-label="Status">
                    {STATUSES.map((st) => (
                        <Button
                            key={st.value}
                            size="sm"
                            variant={
                                status === st.value ? 'primary' : 'default'
                            }
                            aria-pressed={status === st.value}
                            onClick={() => refilter(() => setStatus(st.value))}
                        >
                            {st.label}
                        </Button>
                    ))}
                </div>
                <select
                    aria-label="Client"
                    className="select"
                    value={client}
                    onChange={(e) => refilter(() => setClient(e.target.value))}
                >
                    <option value="">All clients</option>
                    {clients.map((c) => (
                        <option key={c.client} value={c.client}>
                            {c.client}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                {error && <p className="sm aic-activity-error">{error}</p>}
                <div className="ctable-wrap">
                    <table className="ctable">
                        <thead>
                            <tr>
                                <th scope="col">Time</th>
                                <th scope="col">Client</th>
                                <th scope="col">Tool</th>
                                <th scope="col">Connection</th>
                                <th scope="col">Arguments</th>
                                <th scope="col">Result</th>
                                <th scope="col">Took</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <ActivityRow
                                    key={e.id}
                                    entry={e}
                                    fresh={fresh.has(e.id)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
                {entries.length < total && (
                    <Button onClick={() => setLimit(limit + PAGE_SIZE)}>
                        Show {PAGE_SIZE} more
                    </Button>
                )}
            </div>
            {confirmClear && (
                <Modal
                    title="Clear AI activity"
                    onClose={() => setConfirmClear(false)}
                    footer={
                        <>
                            <Button onClick={() => setConfirmClear(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => void clear()}
                            >
                                Clear
                            </Button>
                        </>
                    }
                >
                    <p className="sm tx2">
                        This deletes every logged AI call. It cannot be undone.
                    </p>
                </Modal>
            )}
        </section>
    );
}
