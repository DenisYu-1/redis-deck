import type {
    RedisConnection,
    SearchKeysResponse,
    KeyCountResponse,
    KeyDetails,
    RealtimeStats,
    CommandStatsResponse,
    MemoryByPatternResponse,
    SlowLogResponse,
    HistoryResponse
} from '@/types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || response.statusText);
    }
    return response.json() as Promise<T>;
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
        `${API_BASE}/connections/${environmentId}/test`
    );
    const result = await handleResponse<{ success: boolean }>(response);
    return result.success;
}

export async function searchKeys(
    pattern: string,
    cursors: string[],
    count: number,
    environment: string
): Promise<SearchKeysResponse> {
    const params = new URLSearchParams({
        pattern,
        cursors: JSON.stringify(cursors),
        count: count.toString(),
        env: environment
    });
    const response = await fetch(
        `${API_BASE}/keys?${params}`
    );
    return handleResponse<SearchKeysResponse>(response);
}

export async function getKeyCount(
    environment: string
): Promise<KeyCountResponse> {
    const response = await fetch(`${API_BASE}/keys/count/${environment}`);
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

export async function saveKey(
    key: string,
    value: unknown,
    expiry: number | null,
    environment: string
): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/keys/save/${environment}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value, expiry })
    });
    return handleResponse<{ success: boolean }>(response);
}

export async function deleteKey(
    key: string,
    environment: string
): Promise<{ success: boolean; deletedCount: number }> {
    const response = await fetch(`${API_BASE}/keys/delete/${environment}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key })
    });
    return handleResponse<{ success: boolean; deletedCount: number }>(response);
}

export async function setTTL(
    key: string,
    seconds: number,
    environment: string
): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/keys/ttl/${environment}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, seconds })
    });
    return handleResponse<{ success: boolean }>(response);
}

export async function renameKey(
    oldKey: string,
    newKey: string,
    environment: string
): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/keys/rename/${environment}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldKey, newKey })
    });
    return handleResponse<{ success: boolean }>(response);
}

export async function copyKey(
    sourceKey: string,
    targetKey: string,
    sourceEnv: string,
    targetEnv: string
): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/keys/copy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sourceKey,
            targetKey,
            sourceEnv,
            targetEnv
        })
    });
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

export async function deleteConnection(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE'
    });
    await handleResponse<void>(response);
}

export async function addToSortedSet(
    key: string,
    members: Array<{ score: number; value: string }>,
    expiry: number | null,
    environment: string
): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/keys/${encodeURIComponent(key)}/zadd?env=${environment}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ members, expiry })
    });
    return handleResponse<{ success: boolean }>(response);
}
