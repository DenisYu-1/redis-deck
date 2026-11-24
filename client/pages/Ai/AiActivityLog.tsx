import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import {
    getAiActivityLogging,
    listAiActivity,
    setAiActivityLogging,
    type AiActivityEntry,
    type AiActivityPage
} from '@/services/apiService';

const PAGE_SIZE = 50;

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
function ActivityRow({ entry: e }: { entry: AiActivityEntry }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <tr
                data-testid="ai-activity-row"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                style={{ cursor: 'pointer' }}
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

/** AI activity log: every call an AI client made, per Connection. */
export function AiActivityLog() {
    const connections = useAppStore((s) => s.connections);
    const [connectionId, setConnectionId] = useState('');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState<AiActivityPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logEnabled, setLogEnabled] = useState<boolean | null>(null);
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

    useEffect(() => {
        let cancelled = false;
        listAiActivity({
            connectionId, // '' = all Connections
            limit: PAGE_SIZE,
            offset
        }).then(
            (p) => {
                if (cancelled) return;
                setPage(p);
                setError(null);
            },
            (e: Error) => {
                if (!cancelled) setError(e.message);
            }
        );
        return () => {
            cancelled = true;
        };
    }, [connectionId, offset]);

    const total = page?.total ?? 0;

    return (
        <section className="card sect" aria-label="AI activity">
            <div className="sechead">
                <div className="cmain-title">
                    <h2>AI activity</h2>
                    <span className="sm mu">
                        {total === 0
                            ? 'No entries'
                            : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
                    </span>
                </div>
                <select
                    aria-label="Connection"
                    className="select"
                    value={connectionId}
                    onChange={(e) => {
                        setConnectionId(e.target.value);
                        setOffset(0);
                    }}
                >
                    <option value="">All Connections</option>
                    {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.id}
                        </option>
                    ))}
                </select>
                <Button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                    Newer
                </Button>
                <Button
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                    Older
                </Button>
                <label className="aic-log-toggle">
                    <input
                        type="checkbox"
                        checked={logEnabled ?? true}
                        disabled={logEnabled === null}
                        onChange={(e) => void toggleLogging(e.target.checked)}
                    />
                    Log AI operations
                </label>
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
                            {page?.entries.map((e) => (
                                <ActivityRow key={e.id} entry={e} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
