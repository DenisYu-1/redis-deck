export interface ValueRow {
    id: string;
    /** Hash field or list index; absent for set/zset members. */
    label?: string;
    value: string;
    score?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/** Flattens a `GET /keys/:key` value into table rows for hash/list/set/zset. */
export function toRows(type: string, value: unknown): ValueRow[] {
    if (type === 'hash' && value && typeof value === 'object') {
        return Object.entries(value).map(([k, v]) => ({
            id: k,
            label: k,
            value: str(v)
        }));
    }
    if (!Array.isArray(value)) return [];
    if (type === 'list') {
        return value.map((v, i) => ({
            id: String(i),
            label: String(i),
            value: str(v)
        }));
    }
    if (type === 'set') {
        return value.map((v) => ({ id: str(v), value: str(v) }));
    }
    if (type === 'zset') {
        return (value as { member: unknown; score: unknown }[]).map((e) => ({
            id: str(e.member),
            value: str(e.member),
            score: String(e.score)
        }));
    }
    return [];
}

export function filterRows(rows: ValueRow[], filter: string): ValueRow[] {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
        (r) =>
            r.value.toLowerCase().includes(needle) ||
            (r.label?.toLowerCase().includes(needle) ?? false)
    );
}

// 2001-09-09 .. 2100 in seconds; same range x1000 in milliseconds.
const MIN_SEC = 1e9;
const MAX_SEC = 4.1e9;

/** Date hint for a zset score that looks like an epoch timestamp, else null. */
export function scoreDateHint(score: string): string | null {
    if (!/^\d+$/.test(score)) return null;
    const n = Number(score);
    let ms: number;
    if (n >= MIN_SEC && n <= MAX_SEC) ms = n * 1000;
    else if (n >= MIN_SEC * 1000 && n <= MAX_SEC * 1000) ms = n;
    else return null;
    return `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}
