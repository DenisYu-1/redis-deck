export interface ParsedRedisUri {
    tls: boolean;
    username: string;
    password: string;
    host: string;
    port: number;
    db: number;
}

/** Parse a redis:// or rediss:// URI; returns null when it is not valid. */
export function parseRedisUri(input: string): ParsedRedisUri | null {
    const text = input.trim();
    if (!/^rediss?:\/\//i.test(text)) return null;
    let url: URL;
    try {
        url = new URL(text);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host) return null;
    const port = url.port ? Number(url.port) : 6379;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    const dbPart = url.pathname.replace(/^\//, '');
    if (dbPart && !/^\d+$/.test(dbPart)) return null;
    return {
        tls: url.protocol.toLowerCase() === 'rediss:',
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        host,
        port,
        db: dbPart ? Number(dbPart) : 0
    };
}
