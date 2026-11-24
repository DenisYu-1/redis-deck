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
    HistoryResponse,
    DeleteProgress,
    ExportProgress,
    Job,
    ConnectionTier
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
        `${API_BASE}/keys?${params.toString()}`,
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
        `${API_BASE}/stats/memory-by-pattern?${params.toString()}`
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
    await handleResponse<undefined>(response);
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
    await handleResponse<undefined>(response);
}

const jsonPost = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

/** Sizes for visible rows on clustered Connections; null = Key gone. */
export async function getKeySizes(
    keys: { key: string; node?: string | undefined }[],
    environment: string
): Promise<Record<string, number | null>> {
    const response = await fetch(
        `${API_BASE}/keys/sizes?env=${encodeURIComponent(environment)}`,
        jsonPost({ keys })
    );
    return (
        await handleResponse<{ sizes: Record<string, number | null> }>(response)
    ).sizes;
}

/** seconds > 0 sets an expiry; null removes it (PERSIST). */
export async function setKeysTtl(
    keys: string[],
    seconds: number | null,
    environment: string
): Promise<{ updated: number }> {
    const response = await writeFetch(
        `${API_BASE}/keys/ttl?env=${environment}`,
        jsonPost({ keys, seconds }),
        environment
    );
    return handleResponse<{ updated: number }>(response);
}

/** Bulk delete as a server job: a pattern (optionally a SCAN type) or Keys. */
export async function startDeleteJob(
    target: { pattern: string; type?: string } | { keys: string[] },
    environment: string
): Promise<Job> {
    const response = await writeFetch(
        `${API_BASE}/jobs/delete?env=${encodeURIComponent(environment)}`,
        jsonPost(target),
        environment
    );
    return handleResponse<Job>(response);
}

/**
 * Export as a server job: a pattern (optionally a SCAN type) or Keys. A read:
 * no write guard. The server stops at 1000 Keys.
 */
export async function startExportJob(
    target: { pattern: string; type?: string } | { keys: string[] },
    environment: string
): Promise<Job<ExportProgress>> {
    const response = await fetch(
        `${API_BASE}/jobs/export?env=${encodeURIComponent(environment)}`,
        jsonPost(target)
    );
    return handleResponse<Job<ExportProgress>>(response);
}

/** The finished job's result, served as a JSON download. */
export function jobResultUrl(id: string): string {
    return `${API_BASE}/jobs/${id}/result`;
}

export async function getJob<P = DeleteProgress>(id: string): Promise<Job<P>> {
    return handleResponse<Job<P>>(await fetch(`${API_BASE}/jobs/${id}`));
}

/** Newest first. */
export async function listJobs<P = DeleteProgress>(
    environment: string,
    kind: string
): Promise<Job<P>[]> {
    const params = new URLSearchParams({ env: environment, kind });
    const { jobs } = await handleResponse<{ jobs: Job<P>[] }>(
        await fetch(`${API_BASE}/jobs?${params.toString()}`)
    );
    return jobs;
}

export async function cancelJob<P = DeleteProgress>(
    id: string
): Promise<Job<P>> {
    return handleResponse<Job<P>>(
        await fetch(`${API_BASE}/jobs/${id}/cancel`, { method: 'POST' })
    );
}

export async function deleteConnection(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE'
    });
    await handleResponse<undefined>(response);
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

// AI clients (MCP) installer: Desktop app only (routes exist only there).
export type AiClientStatus = 'not-installed' | 'installed' | 'stale' | 'error';

export interface AiClient {
    id: string;
    name: string;
    configPath: string;
    status: AiClientStatus;
    error?: string;
}

export interface AiClientSnippet {
    path: string;
    text: string;
}

const aiClientUrl = (id: string, action: string) =>
    `${API_BASE}/ai-clients/${encodeURIComponent(id)}/${action}`;

export interface AiClientList {
    clients: AiClient[];
    /** The stdio command line the installer writes (`<binary> --mcp`). */
    command: string;
}

export async function listAiClients(): Promise<AiClientList> {
    const response = await fetch(`${API_BASE}/ai-clients`);
    return handleResponse<AiClientList>(response);
}

export type AiAccessField = 'keys' | 'values' | 'write' | 'workflows' | 'ask';

export interface AiAccessRow extends Record<AiAccessField, boolean> {
    id: string;
    tier: ConnectionTier;
    readOnly: boolean;
}

export async function listAiAccess(): Promise<AiAccessRow[]> {
    const response = await fetch(`${API_BASE}/ai-access`);
    const result = await handleResponse<{ connections: AiAccessRow[] }>(
        response
    );
    return result.connections;
}

/** Saves one change; the server applies the dependency rules and returns the row. */
export async function setAiAccess(
    id: string,
    patch: Partial<Record<AiAccessField, boolean>>
): Promise<Record<AiAccessField, boolean>> {
    const response = await fetch(
        `${API_BASE}/ai-access/${encodeURIComponent(id)}`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        }
    );
    return handleResponse(response);
}

export async function installAiClient(id: string): Promise<void> {
    await handleResponse(
        await fetch(aiClientUrl(id, 'install'), { method: 'POST' })
    );
}

export async function removeAiClient(id: string): Promise<void> {
    await handleResponse(
        await fetch(aiClientUrl(id, 'remove'), { method: 'POST' })
    );
}

export async function getAiClientSnippet(id: string): Promise<AiClientSnippet> {
    return handleResponse<AiClientSnippet>(
        await fetch(aiClientUrl(id, 'snippet'))
    );
}

// AI activity: every MCP call (reads, writes, refusals), plus the "Log AI
// operations" toggle. App settings, not Redis writes (no write guard).
export type AiActivityResult = 'ok' | 'denied' | 'blocked' | 'error';

export interface AiActivityEntry {
    id: number;
    /** ms since epoch */
    time: number;
    client: string;
    connectionId: string;
    operation: string;
    /** The Key, or the Workflow id */
    target: string | null;
    result: AiActivityResult;
    error: string | null;
    /** Masked request args, JSON text */
    args: string | null;
    /** Masked response, JSON text, capped (may end mid-JSON) */
    response: string | null;
    durationMs: number | null;
}

export interface AiActivityPage {
    entries: AiActivityEntry[];
    total: number;
}

export async function listAiActivity(params: {
    connectionId?: string;
    /** Text matched against tool, Key and Connection */
    q?: string;
    status?: AiActivityResult | '';
    client?: string;
    limit?: number;
    offset?: number;
}): Promise<AiActivityPage> {
    const query = new URLSearchParams();
    if (params.connectionId) query.set('connectionId', params.connectionId);
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    if (params.client) query.set('client', params.client);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    return handleResponse<AiActivityPage>(
        await fetch(`${API_BASE}/ai-activity?${query.toString()}`)
    );
}

export interface AiActivityClient {
    client: string;
    /** ms since epoch */
    lastCallAt: number;
}

export async function listAiActivityClients(): Promise<AiActivityClient[]> {
    const response = await fetch(`${API_BASE}/ai-activity/clients`);
    return (await handleResponse<{ clients: AiActivityClient[] }>(response))
        .clients;
}

export async function clearAiActivity(): Promise<void> {
    await handleResponse(
        await fetch(`${API_BASE}/ai-activity`, { method: 'DELETE' })
    );
}

const aiLogSettings = async (init?: RequestInit): Promise<boolean> => {
    const response = await fetch(`${API_BASE}/ai-activity/settings`, init);
    return (await handleResponse<{ logEnabled: boolean }>(response)).logEnabled;
};

export const getAiActivityLogging = (): Promise<boolean> => aiLogSettings();

export const setAiActivityLogging = (logEnabled: boolean): Promise<boolean> =>
    aiLogSettings({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logEnabled })
    });

// MCP tool switches: which tools AI clients may see and call (one global
// setting). The list comes from the tools the server really registers.
export interface AiTool {
    name: string;
    description: string;
    /** Changes data (tagged "write" on the page) */
    write: boolean;
    enabled: boolean;
}

export async function listAiTools(): Promise<AiTool[]> {
    return (
        await handleResponse<{ tools: AiTool[] }>(
            await fetch(`${API_BASE}/ai-tools`)
        )
    ).tools;
}

export async function setAiToolEnabled(
    name: string,
    enabled: boolean
): Promise<AiTool[]> {
    return (
        await handleResponse<{ tools: AiTool[] }>(
            await fetch(`${API_BASE}/ai-tools/${encodeURIComponent(name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            })
        )
    ).tools;
}
// Hidden fields: names whose values AI clients never see (masked as ●●●).
const aiHiddenFields = async (init?: RequestInit): Promise<string[]> => {
    const response = await fetch(`${API_BASE}/ai-hidden-fields`, init);
    return (await handleResponse<{ fields: string[] }>(response)).fields;
};

export const getAiHiddenFields = (): Promise<string[]> => aiHiddenFields();

export const setAiHiddenFields = (fields: string[]): Promise<string[]> =>
    aiHiddenFields({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
