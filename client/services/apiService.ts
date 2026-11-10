import type {
    RedisConnection,
    SearchKeysResponse,
    KeyCountResponse,
    KeyDetails,
    KeyInfo,
    RealtimeStats,
    CommandStatsResponse,
    MemoryByPatternResponse,
    SlowLogResponse,
    HistoryResponse
} from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const body = await response.text();
        let message = body;
        try {
            message = (JSON.parse(body) as { error?: string }).error ?? body;
        } catch {
            // not JSON: use the raw text
        }
        if (response.status === 403 || response.status === 428) {
            // write guard refusal: surface it even if the caller swallows errors
            showToast(message, 'error');
        }
        throw new Error(message || response.statusText);
    }
    return response.json() as Promise<T>;
}

/**
 * Fetch for a request that writes to `connectionId`. The server enforces
 * Read-only (403) and Confirm-writes (428); this only collects the typed
 * connection name for the latter. Refusals are toasted in handleResponse.
 */
async function writeFetch(
    url: string,
    init: RequestInit,
    connectionId: string
): Promise<Response> {
    const conn = useAppStore
        .getState()
        .connections.find((c) => c.id === connectionId);
    const headers = { ...(init.headers as Record<string, string>) };
    if (conn?.confirmWrites) {
        const typed = window.prompt(
            `Writes to '${connectionId}' need confirmation. Type the connection name to continue.`
        );
        if (typed !== connectionId) {
            throw new Error('Write cancelled: connection name did not match');
        }
        headers['X-Confirm-Connection'] = connectionId;
    }
    const response = await fetch(url, { ...init, headers });
    return response;
}

export async function loadEnvironments(): Promise<RedisConnection[]> {
    const response = await fetch(`${API_BASE}/connections`);
    const result = await handleResponse<{ connections: RedisConnection[] }>(
        response
    );
    return result.connections;
}

export async function testConnection(environmentId: string): Promise<boolean> {
    const response = await fetch(
        `${API_BASE}/connections/${environmentId}/test`,
        {
            method: 'POST'
        }
    );
    const result = await handleResponse<{ success: boolean }>(response);
    return result.success;
}

export async function testConnectionConfig(
    connection: RedisConnection
): Promise<boolean> {
    const response = await fetch(`${API_BASE}/connections/test`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(connection)
    });
    const result = await handleResponse<{ success: boolean }>(response);
    return result.success;
}

export async function searchKeys(
    pattern: string,
    cursors: string[],
    count: number,
    environment: string,
    signal?: AbortSignal,
    filters: { type?: string; ttl?: string } = {}
): Promise<SearchKeysResponse> {
    const params = new URLSearchParams({
        pattern,
        cursors: JSON.stringify(cursors),
        count: count.toString(),
        env: environment
    });
    if (filters.type) params.set('type', filters.type);
    if (filters.ttl && filters.ttl !== 'any') params.set('ttl', filters.ttl);
    const response = await fetch(
        `${API_BASE}/keys?${params}`,
        signal ? { signal } : undefined
    );
    return handleResponse<SearchKeysResponse>(response);
}

export async function getKeyCount(
    environment: string
): Promise<KeyCountResponse> {
    const response = await fetch(`${API_BASE}/keycount?env=${environment}`);
    return handleResponse<KeyCountResponse>(response);
}

export async function getKeyDetails(
    key: string,
    environment: string
): Promise<KeyDetails> {
    const response = await fetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}?env=${environment}`
    );
    return handleResponse<KeyDetails>(response);
}

export async function getKeyInfo(
    key: string,
    environment: string
): Promise<KeyInfo> {
    const response = await fetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}/meta?env=${environment}`
    );
    return handleResponse<KeyInfo>(response);
}

export async function saveKey(
    key: string,
    value: unknown,
    expiry: number | null,
    environment: string,
    type = 'string'
): Promise<{ success: boolean }> {
    const response = await writeFetch(
        `${API_BASE}/keys?env=${environment}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, value, expiry, type })
        },
        environment
    );
    return handleResponse<{ success: boolean }>(response);
}

export async function deleteKey(
    key: string,
    environment: string
): Promise<{ success: boolean; deletedCount: number }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}?env=${environment}`,
        {
            method: 'DELETE'
        },
        environment
    );
    return handleResponse<{ success: boolean; deletedCount: number }>(response);
}

export async function setTTL(
    key: string,
    seconds: number,
    environment: string
): Promise<{ success: boolean }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}/expire?env=${environment}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ seconds })
        },
        environment
    );
    return handleResponse<{ success: boolean }>(response);
}

export async function renameKey(
    oldKey: string,
    newKey: string,
    environment: string
): Promise<{ success: boolean }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(oldKey)}/rename?env=${environment}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newKey })
        },
        environment
    );
    return handleResponse<{ success: boolean }>(response);
}

export async function copyKey(
    sourceKey: string,
    targetKey: string,
    sourceEnv: string,
    targetEnv: string
): Promise<{ success: boolean }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(sourceKey)}/copy?env=${sourceEnv}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetKey, targetEnv })
        },
        targetEnv
    );
    return handleResponse<{ success: boolean }>(response);
}

// Statistics API functions
export async function getRealtimeStats(
    environment: string
): Promise<RealtimeStats> {
    const response = await fetch(
        `${API_BASE}/stats/realtime?env=${environment}`
    );
    return handleResponse<RealtimeStats>(response);
}

export async function getCommandStats(
    environment: string
): Promise<CommandStatsResponse> {
    const response = await fetch(
        `${API_BASE}/stats/commandstats?env=${environment}`
    );
    return handleResponse<CommandStatsResponse>(response);
}

export async function getMemoryByPattern(
    environment: string,
    sampleSize: number,
    fastMode: boolean
): Promise<MemoryByPatternResponse> {
    const params = new URLSearchParams({
        env: environment,
        sample: sampleSize.toString(),
        fast: fastMode.toString()
    });
    const response = await fetch(
        `${API_BASE}/stats/memory-by-pattern?${params}`
    );
    return handleResponse<MemoryByPatternResponse>(response);
}

export async function getSlowLog(
    environment: string,
    count = 10
): Promise<SlowLogResponse> {
    const response = await fetch(
        `${API_BASE}/stats/slowlog?env=${environment}&count=${count}`
    );
    return handleResponse<SlowLogResponse>(response);
}

export async function getHistoryStats(
    environment: string,
    hours = 24
): Promise<HistoryResponse> {
    const response = await fetch(
        `${API_BASE}/stats/history?env=${environment}&hours=${hours}`
    );
    return handleResponse<HistoryResponse>(response);
}

export async function takeSnapshot(
    environment: string
): Promise<{ success: boolean }> {
    const response = await fetch(
        `${API_BASE}/stats/snapshot?env=${environment}`,
        {
            method: 'POST'
        }
    );
    return handleResponse<{ success: boolean }>(response);
}

export async function addConnection(
    connection: Omit<RedisConnection, 'displayOrder'>
): Promise<void> {
    const response = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(connection)
    });
    await handleResponse<void>(response);
}

export async function updateConnection(
    connection: RedisConnection
): Promise<void> {
    const response = await fetch(`${API_BASE}/connections/${connection.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(connection)
    });
    await handleResponse<void>(response);
}

export async function deleteKeysByPattern(
    pattern: string,
    environment: string
): Promise<{ count: number; message: string }> {
    const params = new URLSearchParams({
        env: environment,
        pattern
    });
    const response = await writeFetch(
        `${API_BASE}/allkeys?${params}`,
        {
            method: 'DELETE'
        },
        environment
    );
    return handleResponse<{ count: number; message: string }>(response);
}

export async function deleteConnection(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE'
    });
    await handleResponse<void>(response);
}

export async function addToSortedSet(
    key: string,
    members: { score: number; value: string }[],
    expiry: number | null,
    environment: string
): Promise<{ success: boolean }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}/zadd?env=${environment}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ members, expiry })
        },
        environment
    );
    return handleResponse<{ success: boolean }>(response);
}

export interface ServerStatus {
    version: string;
    pingMs: number;
}

export async function getServerStatus(
    environment: string
): Promise<ServerStatus> {
    const started = performance.now();
    const response = await fetch(
        `${API_BASE}/info?env=${encodeURIComponent(environment)}`
    );
    const info = await handleResponse<{
        server?: { redis_version?: string };
    }>(response);
    return {
        version: info.server?.redis_version ?? '?',
        pingMs: Math.round(performance.now() - started)
    };
}
