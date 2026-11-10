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
import type { WorkflowPlugin, WorkflowRun } from '@/types/workflows';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';
import { requestWriteConfirmation } from '@/utils/confirmWrite';

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
        if (!(await requestWriteConfirmation(connectionId))) {
            throw new Error('Write cancelled: connection name not confirmed');
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

/** Test an unsaved or edited Connection; a saved `id` with no password uses the stored one. */
export async function testConnectionDraft(
    connection: RedisConnection
): Promise<{ success: boolean; message: string }> {
    try {
        const response = await fetch(`${API_BASE}/connections/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(connection)
        });
        const body = (await response.json()) as {
            success?: boolean;
            message?: string;
            error?: string;
        };
        return {
            success: Boolean(body.success),
            message: body.error ?? body.message ?? 'Connection failed'
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Test failed'
        };
    }
}

export async function reorderConnections(ids: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/connections/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionIds: ids })
    });
    await handleResponse<unknown>(response);
}

export function connectionsExportUrl(includePasswords: boolean): string {
    return `${API_BASE}/connections/export${includePasswords ? '?includePasswords=true' : ''}`;
}

export async function importConnections(
    connections: unknown[]
): Promise<{ imported: number; errors: number }> {
    const response = await fetch(`${API_BASE}/connections/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections })
    });
    const result = await handleResponse<{
        results: { imported: unknown[]; errors: unknown[] };
    }>(response);
    return {
        imported: result.results.imported.length,
        errors: result.results.errors.length
    };
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

/** Adds one hash field ({ field, value }) or zset member ({ member, score }). */
export async function addMember(
    key: string,
    entry: { field: string; value: string } | { member: string; score: number },
    environment: string
): Promise<{ success: boolean; type: string }> {
    const response = await writeFetch(
        `${API_BASE}/keys/${encodeURIComponent(key)}/members?env=${environment}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        },
        environment
    );
    return handleResponse<{ success: boolean; type: string }>(response);
}

export async function getWorkflows(): Promise<WorkflowPlugin[]> {
    const response = await fetch(`${API_BASE}/workflows`);
    const result = await handleResponse<{ plugins: WorkflowPlugin[] }>(
        response
    );
    return result.plugins;
}

export async function getWorkflowHistory(
    actionId: string
): Promise<WorkflowRun[]> {
    const response = await fetch(
        `${API_BASE}/workflows/${encodeURIComponent(actionId)}/history`
    );
    const result = await handleResponse<{ runs: WorkflowRun[] }>(response);
    return result.runs;
}

export async function planWorkflow(
    actionId: string,
    environment: string,
    inputs: Record<string, string>
): Promise<{ text: string }> {
    const response = await fetch(
        `${API_BASE}/workflows/${encodeURIComponent(actionId)}/plan`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ env: environment, inputs })
        }
    );
    const result = await handleResponse<{ plan: { text: string } }>(response);
    return result.plan;
}

/** Runs a Workflow; `writes` Workflows go through the confirm-writes prompt. */
export async function runWorkflow(
    actionId: string,
    environment: string,
    inputs: Record<string, string>,
    writes: boolean
): Promise<{ ok: boolean; text: string }> {
    const url = `${API_BASE}/workflows/${encodeURIComponent(actionId)}/run`;
    const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env: environment, inputs })
    };
    const response = writes
        ? await writeFetch(url, init, environment)
        : await fetch(url, init);
    const result = await handleResponse<{
        result: { ok: boolean; text: string };
    }>(response);
    return result.result;
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

export interface SavedSearch {
    id: number;
    name: string;
    pattern: string;
}

function searchesUrl(connectionId: string): string {
    return `${API_BASE}/connections/${encodeURIComponent(connectionId)}/searches`;
}

export async function listSavedSearches(
    connectionId: string
): Promise<SavedSearch[]> {
    const response = await fetch(searchesUrl(connectionId));
    const body = await handleResponse<{ searches?: SavedSearch[] }>(response);
    return body.searches ?? [];
}

export async function createSavedSearch(
    connectionId: string,
    name: string,
    pattern: string
): Promise<SavedSearch> {
    const response = await fetch(searchesUrl(connectionId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pattern })
    });
    const body = await handleResponse<{ search: SavedSearch }>(response);
    return body.search;
}

export async function deleteSavedSearch(
    connectionId: string,
    searchId: number
): Promise<void> {
    const response = await fetch(
        `${searchesUrl(connectionId)}/${String(searchId)}`,
        { method: 'DELETE' }
    );
    await handleResponse<unknown>(response);
}
