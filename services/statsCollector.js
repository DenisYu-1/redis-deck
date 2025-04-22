const { execRedisCommand, parseRedisInfo } = require('./redis');
const { getDatabase } = require('./database');

async function collectSnapshot(connectionId) {
    try {
        const db = getDatabase();
        
        const infoResult = await execRedisCommand('INFO', connectionId);
        const sections = parseRedisInfo(infoResult);
        
        const memory = sections.memory || {};
        const stats = sections.stats || {};
        const keyspace = sections.keyspace || {};
        const clients = sections.clients || {};
        const cpu = sections.cpu || {};
        
        let totalKeys = 0;
        for (const [key, value] of Object.entries(keyspace)) {
            if (key.startsWith('db')) {
                const match = value.match(/keys=(\d+)/);
                if (match) {
                    totalKeys += parseInt(match[1]);
                }
            }
        }
        
        const snapshot = {
            connection_id: connectionId,
            timestamp: Math.floor(Date.now() / 1000),
            used_memory: parseInt(memory.used_memory) || 0,
            used_memory_peak: parseInt(memory.used_memory_peak) || 0,
            used_memory_rss: parseInt(memory.used_memory_rss) || 0,
            mem_fragmentation_ratio: parseFloat(memory.mem_fragmentation_ratio) || 0,
            total_keys: totalKeys,
            keyspace_hits: parseInt(stats.keyspace_hits) || 0,
            keyspace_misses: parseInt(stats.keyspace_misses) || 0,
            connected_clients: parseInt(clients.connected_clients) || 0,
            evicted_keys: parseInt(stats.evicted_keys) || 0,
            expired_keys: parseInt(stats.expired_keys) || 0,
            ops_per_sec: parseInt(stats.instantaneous_ops_per_sec) || 0,
            total_net_input_bytes: parseInt(stats.total_net_input_bytes) || 0,
            total_net_output_bytes: parseInt(stats.total_net_output_bytes) || 0,
            used_cpu_sys: parseFloat(cpu.used_cpu_sys) || 0,
            used_cpu_user: parseFloat(cpu.used_cpu_user) || 0,
            total_connections_received: parseInt(stats.total_connections_received) || 0,
            rejected_connections: parseInt(stats.rejected_connections) || 0
        };
        
        const stmt = db.prepare(`
            INSERT INTO stats_snapshots (
                connection_id, timestamp, used_memory, used_memory_peak,
                used_memory_rss, mem_fragmentation_ratio, total_keys,
                keyspace_hits, keyspace_misses, connected_clients,
                evicted_keys, expired_keys, ops_per_sec,
                total_net_input_bytes, total_net_output_bytes,
                used_cpu_sys, used_cpu_user, total_connections_received,
                rejected_connections
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            snapshot.connection_id,
            snapshot.timestamp,
            snapshot.used_memory,
            snapshot.used_memory_peak,
            snapshot.used_memory_rss,
            snapshot.mem_fragmentation_ratio,
            snapshot.total_keys,
            snapshot.keyspace_hits,
            snapshot.keyspace_misses,
            snapshot.connected_clients,
            snapshot.evicted_keys,
            snapshot.expired_keys,
            snapshot.ops_per_sec,
            snapshot.total_net_input_bytes,
            snapshot.total_net_output_bytes,
            snapshot.used_cpu_sys,
            snapshot.used_cpu_user,
            snapshot.total_connections_received,
            snapshot.rejected_connections
        );
        
        console.log(`Stats snapshot collected for ${connectionId}`);
        return snapshot;
        
    } catch (error) {
        console.error(`Error collecting stats for ${connectionId}:`, error);
        throw error;
    }
}

function getHistoricalStats(connectionId, metric, fromTimestamp, toTimestamp) {
    const db = getDatabase();
    const query = `
        SELECT timestamp, ${metric}
        FROM stats_snapshots
        WHERE connection_id = ?
            AND timestamp >= ?
            AND timestamp <= ?
        ORDER BY timestamp ASC
    `;
    
    return db.prepare(query).all(connectionId, fromTimestamp, toTimestamp);
}

function getMultiMetricHistory(connectionId, fromTimestamp, toTimestamp) {
    const db = getDatabase();
    const query = `
        SELECT *
        FROM stats_snapshots
        WHERE connection_id = ?
            AND timestamp >= ?
            AND timestamp <= ?
        ORDER BY timestamp ASC
    `;
    
    return db.prepare(query).all(connectionId, fromTimestamp, toTimestamp);
}

function cleanupOldSnapshots(daysToKeep = 30) {
    const db = getDatabase();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
    const stmt = db.prepare('DELETE FROM stats_snapshots WHERE timestamp < ?');
    const result = stmt.run(cutoffTimestamp);
    
    console.log(`Cleaned up ${result.changes} old snapshots`);
    return result.changes;
}

module.exports = {
    collectSnapshot,
    getHistoricalStats,
    getMultiMetricHistory,
    cleanupOldSnapshots
};

