/** TTL in seconds (Redis semantics: -1 no expiry, -2 missing) -> short text. */
export function formatTtl(ttl: number): string {
    if (ttl === -1) return '∞';
    if (ttl < 0) return 'gone';
    if (ttl < 60) return `${String(ttl)}s`;
    const units: [string, number][] = [
        ['d', 86400],
        ['h', 3600],
        ['m', 60]
    ];
    const parts: string[] = [];
    let rest = ttl;
    for (const [label, size] of units) {
        const n = Math.floor(rest / size);
        rest -= n * size;
        if (n > 0 && parts.length < 2) parts.push(`${String(n)}${label}`);
    }
    return parts.join(' ');
}

/** Expiring in under 5 minutes. */
export function isTtlWarn(ttl: number): boolean {
    return ttl >= 0 && ttl < 300;
}
