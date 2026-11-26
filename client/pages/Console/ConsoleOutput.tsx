import { useAppStore } from '@/store/useAppStore';

/** The history of every statement run since the app was loaded. */
export function ConsoleOutput() {
    const lines = useAppStore((s) => s.consoleOutput);
    if (lines.length === 0) {
        return <div className="scalar mu">Run a line to see its reply.</div>;
    }
    return (
        <ul className="outlist">
            {lines.map((o) => (
                <li key={o.id} className="outln">
                    <span className="mu">[{o.time}]</span>{' '}
                    <span className="mu">{o.env}&gt;</span>{' '}
                    <span className="ellip outcmd">{o.text}</span>{' '}
                    <span className={`ellip outsum ${o.failed ? 'bad' : ''}`}>
                        → {o.summary}
                    </span>
                </li>
            ))}
        </ul>
    );
}
