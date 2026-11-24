import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { listAiActivity, type AiActivityPage } from '@/services/apiService';

const PAGE_SIZE = 50;

/** AI activity log: what AI clients wrote, or tried to write, per Connection. */
export function AiActivityPage() {
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
        <div className="cwrap nodrawer">
            <section className="cmain">
                <div className="viewhead">
                    <div className="cmain-title">
                        <h1>AI activity</h1>
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
                        onClick={() =>
                            setOffset(Math.max(0, offset - PAGE_SIZE))
                        }
                    >
                        Newer
                    </Button>
                    <Button
                        disabled={offset + PAGE_SIZE >= total}
                        onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                        Older
                    </Button>
                    <Link className="btn" to="/connections">
                        Back to Connections
                    </Link>
                </div>
                <div className="scroll cscroll">
                    {error && <p className="sm aic-activity-error">{error}</p>}
                    <div className="ctable-wrap">
                        <table className="ctable">
                            <thead>
                                <tr>
                                    <th scope="col">Time</th>
                                    <th scope="col">AI client</th>
                                    <th scope="col">Connection</th>
                                    <th scope="col">Operation</th>
                                    <th scope="col">Key or Workflow</th>
                                    <th scope="col">Result</th>
                                    <th scope="col">Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page?.entries.map((e) => (
                                    <tr
                                        key={e.id}
                                        data-testid="ai-activity-row"
                                    >
                                        <td className="mono sm">
                                            {new Date(e.time).toLocaleString()}
                                        </td>
                                        <td>{e.client}</td>
                                        <td>{e.connectionId}</td>
                                        <td className="mono sm">
                                            {e.operation}
                                        </td>
                                        <td className="mono sm aic-activity-target">
                                            {e.target ?? ''}
                                        </td>
                                        <td>
                                            <span
                                                className={`aic-result ${e.result}`}
                                            >
                                                {e.result}
                                            </span>
                                        </td>
                                        <td className="sm mu">
                                            {e.error ?? ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
