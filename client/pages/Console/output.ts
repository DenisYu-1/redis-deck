import type { ConsoleResult } from '@/services/apiService';
import { tableOf } from './shape';

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

function summarize(result: ConsoleResult): string {
    const { kind, reply } = result;
    // an error's reply is text, so it is never a table
    const rows = tableOf(result)?.rows.length;
    if (rows !== undefined) return `${rows} row${rows === 1 ? '' : 's'}`;
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
