import type { ConsoleResult } from '@/services/apiService';

/** A table cell: nested replies (SCAN, SLOWLOG GET) are shown as JSON. */
function cell(value: unknown): string {
    if (value === null) return '(nil)';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** One statement's reply, rendered by its shape. */
export function ConsoleReply({ result }: { result: ConsoleResult }) {
    const { kind, reply } = result;
    if (kind === 'error') {
        return (
            <div className="rerr" role="alert">
                {String(reply)}
            </div>
        );
    }
    if (kind === 'not-run') {
        return <div className="scalar mu">Not run</div>;
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
