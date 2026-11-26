import type { ConsoleResult } from '@/services/apiService';

/** One line of the Output history: `[time] conn> command → summary`. */
export interface OutputLine {
    id: number;
    time: string;
    env: string;
    text: string;
    summary: string;
    failed: boolean;
}

let lastId = 0;

function summarize({ kind, reply }: ConsoleResult): string {
    if (Array.isArray(reply)) {
        return `${reply.length} row${reply.length === 1 ? '' : 's'}`;
    }
    if (kind === 'integer') return `(integer) ${String(reply)}`;
    if (kind === 'nil') return '(nil)';
    if (kind === 'bulk') return `${String(reply).length} chars`;
    return String(reply);
}

/** The history lines of one run, newest (last statement) first. */
export function outputLines(
    env: string,
    results: ConsoleResult[]
): OutputLine[] {
    const time = new Date().toLocaleTimeString('en-GB');
    const failedLine = results.find((r) => r.kind === 'error')?.line;
    return results
        .map((result) => ({
            id: ++lastId,
            time,
            env,
            text: result.text,
            summary:
                result.kind === 'not-run'
                    ? `stopped at line ${failedLine}`
                    : summarize(result),
            failed: result.kind === 'error'
        }))
        .reverse();
}
