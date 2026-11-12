import type { ConnectionTier, RedisConnection } from '@/types';
import type { ParsedRedisUri } from './uriParser';

/** Fill a draft from a parsed URI; a new draft with no name takes the host's first label. */
export function applyParsedUri(
    draft: ConnectionDraft,
    parsed: ParsedRedisUri
): ConnectionDraft {
    return {
        ...draft,
        tls: parsed.tls,
        username: parsed.username,
        password: parsed.password || draft.password,
        host: parsed.host,
        port: String(parsed.port),
        db: String(parsed.db),
        id:
            draft.id ||
            (draft.isNew
                ? (parsed.host.split('.')[0] ?? parsed.host)
                : draft.id)
    };
}

/** Form state for a Connection. Numbers are strings while being typed. */
export interface ConnectionDraft {
    isNew: boolean;
    id: string;
    tier: ConnectionTier;
    host: string;
    port: string;
    db: string;
    username: string;
    /** Only ever holds what the user typed; stored passwords never reach the client. */
    password: string;
    hasPassword: boolean;
    tls: boolean;
    verifyTls: boolean;
    cluster: boolean;
    readOnly: boolean;
    confirmWrites: boolean;
}

export function blankDraft(): ConnectionDraft {
    return {
        isNew: true,
        id: '',
        tier: 'local',
        host: '',
        port: '6379',
        db: '0',
        username: '',
        password: '',
        hasPassword: false,
        tls: false,
        verifyTls: true,
        cluster: false,
        readOnly: false,
        confirmWrites: false
    };
}

export function draftFromConnection(c: RedisConnection): ConnectionDraft {
    return {
        isNew: false,
        id: c.id,
        tier: c.tier ?? 'local',
        host: c.host,
        port: String(c.port),
        db: String(c.db ?? 0),
        username: c.username ?? '',
        password: '',
        hasPassword: Boolean(c.hasPassword),
        tls: c.tls,
        verifyTls: c.verifyTls !== false,
        cluster: c.cluster,
        readOnly: Boolean(c.readOnly),
        confirmWrites: Boolean(c.confirmWrites)
    };
}

/** API payload. A blank password is omitted so the server keeps the stored one. */
export function draftToPayload(d: ConnectionDraft): RedisConnection {
    return {
        id: d.id.trim(),
        host: d.host.trim(),
        port: Number(d.port) || 6379,
        db: Number(d.db) || 0,
        username: d.username,
        ...(d.password ? { password: d.password } : {}),
        tls: d.tls,
        verifyTls: d.verifyTls,
        cluster: d.cluster,
        tier: d.tier,
        readOnly: d.readOnly,
        confirmWrites: d.confirmWrites
    };
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
    const next = items.slice();
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
}
