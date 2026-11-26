import type { ConsoleResult } from '@/services/apiService';

/** A table cell: nested replies (SCAN, SLOWLOG GET) are shown as JSON. */
function cell(value: unknown): string {
    if (value === null) return '(nil)';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function Reply({ result }: { result: ConsoleResult }) {
    const { kind, reply } = result;
    if (kind === 'error') {
        return (
            <div className="rerr" role="alert">
                {String(reply)}
            </div>
        );
    }
    if (Array.isArray(reply)) {
        if (reply.length === 0) {
            return <div className="scalar mu">(empty array)</div>;
        }
        return (
            <table className="rgrid">
                <tbody>
                    {reply.map((value, i) => (
                        <tr key={i}>
                            <td className="rn">{i + 1}</td>
                            <td>{cell(value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    const text = kind === 'integer' ? `(integer) ${cell(reply)}` : cell(reply);
    return <div className="scalar">{text}</div>;
}

export function ConsoleResults({ results }: { results: ConsoleResult[] }) {
    return (
        <section className="results" aria-label="Results">
            {results.length === 0 && (
                <div className="scalar mu">Run a line to see its reply.</div>
            )}
            {results.map((result) => (
                <div key={result.line}>
                    <div className="rhead mono xs">
                        <span>{result.text}</span>
                        <span className="mu">{result.ms} ms</span>
                    </div>
                    <Reply result={result} />
                </div>
            ))}
        </section>
    );
}
