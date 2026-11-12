/** Redis glob (* ? [abc] [^a] [a-z] \x) -> RegExp. */
export function globToRegExp(glob: string): RegExp {
    let out = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob.charAt(i);
        if (c === '*') out += '[\\s\\S]*';
        else if (c === '?') out += '[\\s\\S]';
        else if (c === '\\' && i + 1 < glob.length) {
            i++;
            out += glob.charAt(i).replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
        } else if (c === '[') {
            const end = glob.indexOf(']', i + 2);
            if (end === -1) {
                out += '\\[';
                continue;
            }
            let body = glob.slice(i + 1, end);
            const neg = body.startsWith('^');
            if (neg) body = body.slice(1);
            out += `[${neg ? '^' : ''}${body.replace(/[\\\]]/g, '\\$&')}]`;
            i = end;
        } else out += c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
    }
    return new RegExp(`^${out}$`);
}

/**
 * [start, end) of the longest literal run of the pattern inside the key, for
 * match highlighting. Null for pure wildcards or when it is not found.
 */
export function highlightRange(
    pattern: string,
    key: string
): [number, number] | null {
    const literals = pattern
        .split(/[*?]|\[[^\]]*\]/)
        .map((s) => s.replace(/\\(.)/g, '$1'));
    const best = literals.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (!best) return null;
    const at = key.indexOf(best);
    return at === -1 ? null : [at, at + best.length];
}
