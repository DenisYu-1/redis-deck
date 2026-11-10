const UNIT_SECONDS: Record<string, number> = {
    '': 1,
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
};

/** TTL text ("90", "5m", "2h", "1d"; blank/"none" = no expiry) -> seconds, -1 for none, null if invalid. */
export function parseTtlInput(text: string): number | null {
    const t = text.trim().toLowerCase();
    if (t === '' || t === 'none') return -1;
    const m = /^(\d+)([smhd]?)$/.exec(t);
    if (!m) return null;
    const n = Number(m[1] ?? 0) * (UNIT_SECONDS[m[2] ?? ''] ?? 1);
    return n > 0 ? n : null;
}

export type NewValue = { value: unknown } | { error: string };

/** Text from the New key dialog -> the value shape `POST /keys` expects. */
export function parseNewValue(type: string, text: string): NewValue {
    if (type === 'string') {
        return text === '' ? { error: 'Value is required' } : { value: text };
    }
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return { error: 'Value is required' };
    if (type === 'hash') {
        const value: Record<string, string> = {};
        for (const line of lines) {
            const i = line.indexOf('=');
            if (i < 1) return { error: `Expected field=value: "${line}"` };
            value[line.slice(0, i)] = line.slice(i + 1);
        }
        return { value };
    }
    if (type === 'zset') {
        const value: { member: string; score: number }[] = [];
        for (const line of lines) {
            const m = /^(\S+)\s+(.+)$/.exec(line);
            if (!m || !Number.isFinite(Number(m[1] ?? 0))) {
                return { error: `Expected "score member": "${line}"` };
            }
            value.push({ member: m[2] ?? '', score: Number(m[1] ?? 0) });
        }
        return { value };
    }
    return { value: lines };
}
