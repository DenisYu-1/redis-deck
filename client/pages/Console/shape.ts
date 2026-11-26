import type { ConsoleResult } from '@/services/apiService';
import { commandWords } from './lineCheck';

export interface TableShape {
    columns: string[];
    rows: unknown[][];
    /** The cells are Key names */
    keys?: boolean;
    /** SCAN: where the next page starts, '0' when the iteration is complete */
    cursor?: string;
}

/** The words of a statement, upper-cased. */
const words = (text: string) =>
    commandWords(text).map((word) => word.toUpperCase());

const scalarColumn = (name: string, values: unknown[]) => ({
    columns: [name],
    rows: values.map((value) => [value])
});

/** The same SCAN, HSCAN, SSCAN or ZSCAN, from another cursor. */
export const scanFrom = (text: string, cursor: string) => {
    // the cursor comes first for SCAN, after the key for the others
    const before =
        words(text)[0] === 'SCAN'
            ? String.raw`\s*\S+\s+`
            : String.raw`\s*\S+\s+(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+)\s+`;
    const pattern = new RegExp(`^(${before})(?:"\\d+"|'\\d+'|\\d+)\\s*`);
    return text.replace(pattern, `$1${cursor} `).trimEnd();
};

/** The columns of a key scan's items, which come flat after the cursor. */
const SCAN_COLUMNS: Record<string, string[]> = {
    HSCAN: ['field', 'value'],
    SSCAN: ['member'],
    ZSCAN: ['member', 'score']
};

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

const chunk = (flat: unknown[], size: number) =>
    Array.from({ length: flat.length / size }, (_, i) =>
        flat.slice(i * size, i * size + size)
    );

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
    const scanned = SCAN_COLUMNS[words(text)[0] ?? ''];
    if (scanned) {
        const [cursor, items] = reply as [string, unknown[]];
        // HSCAN ... NOVALUES lists the fields alone
        const columns = words(text).includes('NOVALUES') ? ['field'] : scanned;
        return { columns, rows: chunk(items.flat(), columns.length), cursor };
    }
    if (returnsKeys(text)) return keyColumn(reply);
    const columns = pairColumns(text);
    if (!columns) return scalarColumn('value', reply);
    // RESP3 nests each pair, RESP2 does not
    return { columns, rows: chunk(reply.flat(), 2) };
}
