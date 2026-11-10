import { TierBadge } from '@/components/ui/Badge';
import type { WorkflowRun } from '@/types/workflows';

export function RunHistory({ runs }: { runs: WorkflowRun[] }) {
    return (
        <section className="card wf-panel" aria-label="History">
            <div className="navhead">
                <span>History</span>
            </div>
            {runs.length === 0 ? (
                <p className="mu sm">No runs yet.</p>
            ) : (
                <ul className="wf-history">
                    {runs.map((r) => (
                        <li key={r.id} data-testid="history-row">
                            <span
                                className={r.ok ? 'mu' : 'err'}
                                aria-label={r.ok ? 'ok' : 'failed'}
                            >
                                {r.ok ? 'OK' : 'FAIL'}
                            </span>
                            <span className="mono xs">
                                {new Date(r.at).toLocaleString()}
                            </span>
                            <span className="mono xs">{r.connection}</span>
                            <TierBadge tier={r.tier} />
                            <code className="mono xs">
                                {JSON.stringify(r.inputs)}
                            </code>
                            <span className="sm">{r.text}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
