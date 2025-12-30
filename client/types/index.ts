export interface RedisConnection {
    id: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    tls: boolean;
    cluster: boolean;
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

export interface SearchKeysResponse {
    keys: string[];
    cursors: string[];
    hasMore: boolean;
    total: string;
}

export interface KeyCountResponse {
    count: number;
}

export type RedisValueType =
    | 'string'
    | 'list'
    | 'set'
    | 'zset'
    | 'hash'
    | 'none';

export interface ToastMessage {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

export interface PluginConfig {
    id: string;
    name: string;
    enabled: boolean;
    path: string;
    priority: number;
    config?: Record<string, unknown>;
}

export interface PluginContext {
    getCurrentEnvironment: () => string;
    onOperationComplete: () => void;
    showToast: (message: string, type: ToastMessage['type']) => void;
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
}

export interface HistoryResponse {
    data: HistoryDataPoint[];
    from: number;
    to: number;
    count: number;
}
