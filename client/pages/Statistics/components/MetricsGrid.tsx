import { formatBytes, formatNumber, formatPercentage } from '@/utils/formatter';
import type { RealtimeStats } from '@/types';

interface MetricsGridProps {
    stats: RealtimeStats;
}

export function MetricsGrid({ stats }: MetricsGridProps) {
    const hitRate =
        stats.stats.keyspace_hits + stats.stats.keyspace_misses > 0
            ? (stats.stats.keyspace_hits /
                  (stats.stats.keyspace_hits + stats.stats.keyspace_misses)) *
              100
            : 0;

    const memoryPercent =
        stats.memory.max > 0 ? (stats.memory.used / stats.memory.max) * 100 : 0;

    const totalNetwork =
        stats.stats.total_net_input_bytes + stats.stats.total_net_output_bytes;

    return (
        <div className="metrics-grid" id="metrics-grid">
            {/* Memory Used */}
            <div className="metric-card">
                <div className="metric-label">Memory Used</div>
                <div className="metric-value" id="metric-memory">
                    {formatBytes(stats.memory.used)}
                </div>
                <div className="metric-subtitle" id="metric-memory-subtitle">
                    Peak: {formatBytes(stats.memory.peak)}
                </div>
                <div className="memory-progress-bar">
                    <div
                        id="memory-progress"
                        style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                    />
                </div>
            </div>

            {/* Total Keys */}
            <div className="metric-card">
                <div className="metric-label">Total Keys</div>
                <div className="metric-value" id="metric-keys">
                    {formatNumber(Object.keys(stats.keyspace).length)}
                </div>
                <div className="metric-subtitle" id="metric-keys-subtitle">
                    Across all databases
                </div>
            </div>

            {/* Hit Rate */}
            <div className="metric-card">
                <div className="metric-label">Hit Rate</div>
                <div className="metric-value" id="metric-hitrate">
                    {formatPercentage(hitRate)}
                </div>
                <div className="metric-subtitle" id="metric-hitrate-subtitle">
                    Cache effectiveness
                </div>
            </div>

            {/* Connected Clients */}
            <div className="metric-card">
                <div className="metric-label">Connected Clients</div>
                <div className="metric-value" id="metric-clients">
                    {formatNumber(stats.clients.connected)}
                </div>
                <div className="metric-subtitle" id="metric-clients-subtitle">
                    Active connections
                </div>
            </div>

            {/* Evicted Keys */}
            <div className="metric-card">
                <div className="metric-label">Evicted Keys</div>
                <div className="metric-value" id="metric-evictions">
                    {formatNumber(stats.stats.evicted_keys)}
                </div>
                <div className="metric-subtitle" id="metric-evictions-subtitle">
                    Due to memory limit
                </div>
            </div>

            {/* Memory Fragmentation */}
            <div className="metric-card">
                <div className="metric-label">Memory Fragmentation</div>
                <div className="metric-value" id="metric-fragmentation">
                    {stats.memory.fragmentation.toFixed(2)}
                </div>
                <div
                    className="metric-subtitle"
                    id="metric-fragmentation-subtitle"
                >
                    RSS/Used ratio
                </div>
            </div>

            {/* Operations/sec */}
            <div className="metric-card">
                <div className="metric-label">Operations/sec</div>
                <div className="metric-value" id="metric-ops">
                    {formatNumber(stats.stats.ops_per_sec)}
                </div>
                <div className="metric-subtitle" id="metric-ops-subtitle">
                    Current throughput
                </div>
            </div>

            {/* CPU Usage */}
            <div className="metric-card">
                <div className="metric-label">CPU Usage</div>
                <div className="metric-value" id="metric-cpu">
                    {(
                        (stats.cpu.used_cpu_sys + stats.cpu.used_cpu_user) *
                        100
                    ).toFixed(1)}
                    %
                </div>
                <div className="metric-subtitle" id="metric-cpu-subtitle">
                    System + User
                </div>
            </div>

            {/* Network I/O */}
            <div className="metric-card">
                <div className="metric-label">Network I/O</div>
                <div className="metric-value" id="metric-network">
                    {formatBytes(totalNetwork)}
                </div>
                <div className="metric-subtitle" id="metric-network-subtitle">
                    Total transferred
                </div>
            </div>

            {/* Total Connections */}
            <div className="metric-card">
                <div className="metric-label">Total Connections</div>
                <div className="metric-value" id="metric-total-conns">
                    {formatNumber(stats.stats.total_connections_received)}
                </div>
                <div
                    className="metric-subtitle"
                    id="metric-total-conns-subtitle"
                >
                    Lifetime received
                </div>
            </div>

            {/* Keys with TTL */}
            <div className="metric-card">
                <div className="metric-label">Keys with TTL</div>
                <div className="metric-value" id="metric-ttl">
                    {formatNumber(stats.ttl_stats.keys_with_ttl)}
                </div>
                <div className="metric-subtitle" id="metric-ttl-subtitle">
                    Will expire
                </div>
            </div>
        </div>
    );
}
