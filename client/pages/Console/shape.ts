import type { ConsoleResult } from '@/services/apiService';

export interface TableShape {
    columns: string[];
    rows: unknown[][];
    /** The cells are Key names */
    keys?: boolean;
    /** SCAN: where the next page starts, '0' when the iteration is complete */
    cursor?: string;
}

/** The words of a statement, upper-cased and without quotes. */
const words = (text: string) =>
    text.replace(/["']/g, '').trim().toUpperCase().split(/\s+/);

const scalarColumn = (name: string, values: unknown[]) => ({
    columns: [name],
    rows: values.map((value) => [value])
});

/** The same SCAN, from another cursor. */
export const scanFrom = (text: string, cursor: string) =>
    text.replace(/^(\s*\S+\s+)\S+/, `$1${cursor}`);

/** Whether the command's reply is Key names. */
export const returnsKeys = (text: string) =>
    ['SCAN', 'KEYS', 'RANDOMKEY'].includes(words(text)[0] ?? '');

const keyColumn = (names: unknown[]) => ({
    ...scalarColumn('key', names),
    keys: true
});

/** The column names when the command's reply is a list of pairs. */
function pairColumns(text: string): string[] | undefined {
    const [command, second, ...rest] = words(text);
    if (command === 'HGETALL') return ['field', 'value'];
    if (command === 'CONFIG' && second === 'GET') {
        return ['parameter', 'value'];
    }
    // after the key (second), start and stop
    if (command === 'ZRANGE' && rest.slice(2).includes('WITHSCORES')) {
        return ['member', 'score'];
    }
    return undefined;
}

/** What Copy JSON copies: the values of one column, else one object per row. */
export const tableJson = ({ columns, rows }: TableShape) =>
    JSON.stringify(
        rows.map((row) =>
            columns.length === 1
                ? row[0]
                : Object.fromEntries(columns.map((c, i) => [c, row[i]]))
        ),
        null,
        2
    );

/** The table a reply is shown as; undefined for a scalar. */
export function tableOf({
    text,
    reply
}: ConsoleResult): TableShape | undefined {
    if (!Array.isArray(reply)) return undefined;
    if (words(text)[0] === 'SCAN') {
        const [cursor, names] = reply as [string, string[]];
        return { ...keyColumn(names), cursor };
    }
    if (returnsKeys(text)) return keyColumn(reply);
    const columns = pairColumns(text);
    if (!columns) return scalarColumn('value', reply);
    // RESP3 nests each pair, RESP2 does not
    const flat: unknown[] = reply.flat();
    const rows = Array.from({ length: flat.length / 2 }, (_, i) =>
        flat.slice(i * 2, i * 2 + 2)
    );
    return { columns, rows };
}
