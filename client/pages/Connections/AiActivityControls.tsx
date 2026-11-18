import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';
import {
    getAiActivityLogging,
    listAiActivity,
    setAiActivityLogging,
    type AiActivityPage
} from '@/services/apiService';

const PAGE_SIZE = 50;

/** "Log AI operations" checkbox and the View activity button (AI clients panel). */
export function AiActivityControls() {
    const [logEnabled, setLogEnabled] = useState<boolean | null>(null);
    const [open, setOpen] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getAiActivityLogging().then(
            (on) => {
                if (!cancelled) setLogEnabled(on);
            },
            (error: Error) =>
                showToast(`AI activity: ${error.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const toggle = async (on: boolean) => {
        try {
            setLogEnabled(await setAiActivityLogging(on));
        } catch (error) {
            showToast((error as Error).message, 'error');
        }
    };

    return (
        <div className="aic-log">
            <label className="aic-log-toggle">
                <input
                    type="checkbox"
                    checked={logEnabled ?? true}
                    disabled={logEnabled === null}
                    onChange={(e) => void toggle(e.target.checked)}
                />
                Log AI operations
            </label>
            <Button size="sm" onClick={() => setOpen(true)}>
                View activity
            </Button>
            {open && <AiActivityModal onClose={() => setOpen(false)} />}
        </div>
    );
}

function AiActivityModal({ onClose }: { onClose: () => void }) {
    const connections = useAppStore((s) => s.connections);
    const [connectionId, setConnectionId] = useState('');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState<AiActivityPage | null>(null);
    const [error, setError] = useState<string | null>(null);

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
        <Modal
            title="AI activity"
            onClose={onClose}
            footer={
                <>
                    <span className="sm mu aic-activity-count">
                        {total === 0
                            ? 'No entries'
                            : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
                    </span>
                    <Button
                        size="sm"
                        disabled={offset === 0}
                        onClick={() =>
                            setOffset(Math.max(0, offset - PAGE_SIZE))
                        }
                    >
                        Newer
                    </Button>
                    <Button
                        size="sm"
                        disabled={offset + PAGE_SIZE >= total}
                        onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                        Older
                    </Button>
                    <Button onClick={onClose}>Close</Button>
                </>
            }
        >
            <div className="field">
                <label htmlFor="aia-conn">Connection</label>
                <select
                    id="aia-conn"
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
            </div>
            {error && <p className="sm aic-activity-error">{error}</p>}
            <div className="ctable-wrap aic-activity">
                <table className="ctable">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>AI client</th>
                            <th>Connection</th>
                            <th>Operation</th>
                            <th>Key or Workflow</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {page?.entries.map((e) => (
                            <tr key={e.id} data-testid="ai-activity-row">
                                <td className="mono sm">
                                    {new Date(e.time).toLocaleString()}
                                </td>
                                <td>{e.client}</td>
                                <td>{e.connectionId}</td>
                                <td className="mono sm">{e.operation}</td>
                                <td className="mono sm aic-activity-target">
                                    {e.target ?? ''}
                                </td>
                                <td>
                                    <span
                                        className={`aic-result ${e.result}`}
                                        title={e.error ?? undefined}
                                    >
                                        {e.result}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
