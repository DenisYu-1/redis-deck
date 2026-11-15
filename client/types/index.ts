export type ConnectionTier = 'local' | 'staging' | 'production';

export interface RedisConnection {
    id: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    /** Server-reported: a password is stored. The password itself never reaches the client. */
    hasPassword?: boolean;
    tls: boolean;
    cluster: boolean;
    tier?: ConnectionTier;
    db?: number;
    verifyTls?: boolean;
    readOnly?: boolean;
    confirmWrites?: boolean;
    displayOrder?: number;
}

export interface RedisKey {
    key: string;
    type: string;
}

export interface KeyDetails {
    key: string;
    type: string;
    ttl: number;
    value: unknown;
    size?: number;
}

/** `GET /keys/:key/meta`; null where Redis cannot answer. */
export interface KeyInfo {
    type: string;
    encoding: string | null;
    /** Seconds since last access. */
    idle: number | null;
    memory: number | null;
    length: number | null;
}

export interface KeyMeta {
    type: string;
    /** Seconds; -1 no expiry, -2 gone. */
    ttl: number;
    /**
     * MEMORY USAGE in bytes, null when unavailable. Absent on clustered
     * Connections until fetched for visible rows (POST /keys/sizes).
     */
    size?: number | null;
    /** Clustered Connections: id of the Node that holds the Key. */
    node?: string;
}

export interface ScanStats {
    iterations: number;
    /** Keys SCAN returned before the TTL filter. */
    returned: number;
    matched: number;
    ms: number;
}

export type TtlFilter = 'any' | 'has' | 'none' | 'lt1h';

/** A cluster Node whose SCAN failed; its cursor is kept so a continue retries it. */
export interface FailedNode {
    id: string;
    /** host:port as the cluster announces it. */
    address: string;
    error: string;
}

/** A server job (bulk delete, export). In memory; lost on server restart. */
export interface Job {
    id: string;
    kind: string;
    /** Connection id. */
    env: string;
    state: 'running' | 'done' | 'cancelled' | 'failed';
    progress: { scanned: number; deleted: number };
    error?: string;
    failedNodes?: FailedNode[];
    startedAt: number;
    finishedAt?: number;
}

export interface SearchKeysResponse {
    keys: string[];
    cursors: string[];
    hasMore: boolean;
    failedNodes?: FailedNode[];
    total: string;
    meta?: Record<string, KeyMeta>;
    scan?: ScanStats;
}

export interface KeyCountResponse {
    count: number;
}

export type RedisValueType =
    'string' | 'list' | 'set' | 'zset' | 'hash' | 'none';

export interface ToastMessage {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

export interface StatsSnapshot {
    timestamp: string;
    memory_used: number;
    memory_peak: number;
    memory_rss: number;
    memory_fragmentation_ratio: number;
    total_keys: number;
    keyspace_hits: number;
    keyspace_misses: number;
    connected_clients: number;
    total_connections_received: number;
    evicted_keys: number;
    expired_keys: number;
    instantaneous_ops_per_sec: number;
    used_cpu_sys: number;
    used_cpu_user: number;
    total_net_input_bytes: number;
    total_net_output_bytes: number;
}

export interface RealtimeStats {
    memory: {
        used: number;
        used_human: string;
        peak: number;
        peak_human: string;
        rss: number;
        fragmentation: number;
        max: number;
        max_human?: string;
    };
    stats: {
        keyspace_hits: number;
        keyspace_misses: number;
        evicted_keys: number;
        expired_keys: number;
        ops_per_sec: number;
        total_net_input_bytes: number;
        total_net_output_bytes: number;
        total_connections_received: number;
        rejected_connections: number;
    };
    clients: {
        connected: number;
        blocked: number;
    };
    server: {
        uptime_days: number;
        redis_version: string;
    };
    cpu: {
        used_cpu_sys: number;
        used_cpu_user: number;
    };
    keyspace: Record<string, string>;
    ttl_stats: {
        keys_with_ttl: number;
        keys_without_ttl: number;
    };
}

export interface CommandStats {
    command: string;
    calls: number;
    usec: number;
    usec_per_call: number;
    calls_per_sec: number;
}

export interface CommandStatsResponse {
    commands: CommandStats[];
    uptime_seconds: number;
    uptime_days: string;
}

export interface MemoryPattern {
    pattern: string;
    count: number;
    total_memory: number;
    avg_memory: number;
    sample_keys: string[];
    percentage: number;
}

export interface MemoryByPatternResponse {
    patterns: MemoryPattern[];
    total_keys: number;
    sampled_keys: number;
    total_memory: number;
    fast_mode: boolean;
}

export interface SlowLogEntry {
    id: number;
    timestamp: number;
    duration_us: number;
    command: string;
}

export interface SlowLogResponse {
    slowlog: SlowLogEntry[];
}

export interface HistoryDataPoint {
    timestamp: number;
    memory_used: number;
    memory_peak: number;
    total_keys: number;
    keyspace_hits: number;
    keyspace_misses: number;
    instantaneous_ops_per_sec: number;
    total_net_input_bytes: number;
    total_net_output_bytes: number;
    connected_clients: number;
    used_cpu_sys: number;
    used_cpu_user: number;
}

export interface HistoryResponse {
    data: HistoryDataPoint[];
    from: number;
    to: number;
    count: number;
}
