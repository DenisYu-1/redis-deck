import type { ChatToolCall } from '@/services/aiChat';

const PILL = { ok: 'ok', denied: 'off', blocked: 'blocked', error: 'error' };

/** The arguments in one line; the Connection is named in the body. */
const summary = (args: Record<string, unknown>): string =>
    Object.entries(args)
        .filter(([name]) => name !== 'connectionId')
        .map(([, value]) =>
            typeof value === 'string' ? value : JSON.stringify(value)
        )
        .join(' ');

/** JSON indented; a refusal's plain text as it is. */
function pretty(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

/** One tool call of the assistant: status, tool, args, time and response. */
export function ToolRow({ call }: { call: ChatToolCall }) {
    const { status, tool, args, ms, response } = call;
    return (
        <details className="chat-tool">
            <summary>
                {status === 'running' ? (
                    <span className="spin" role="img" aria-label="running" />
                ) : (
                    <span className={`pill ${PILL[status]}`}>{status}</span>
                )}
                <span className="mono">{tool}</span>
                <span className="mono xs mu ellip chat-args">
                    {summary(args)}
                </span>
                {ms !== undefined && <span className="xs mu">{ms} ms</span>}
            </summary>
            <div className="chat-tool-body">
                <div className="codeline">{JSON.stringify(args)}</div>
                {response !== undefined && (
                    <pre className="codeline">{pretty(response)}</pre>
                )}
            </div>
        </details>
    );
}
