// Data version 1: the schema as it stood when versioned migrations began.
module.exports = function up(db) {
    db.exec(`
        CREATE TABLE connections (
            id TEXT PRIMARY KEY,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT,
            password TEXT,
            tls INTEGER DEFAULT 0,
            cluster INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            \`order\` INTEGER DEFAULT 0,
            tier TEXT DEFAULT 'local',
            db INTEGER DEFAULT 0,
            verify_tls INTEGER DEFAULT 1,
            read_only INTEGER DEFAULT 0,
            confirm_writes INTEGER DEFAULT 0
        );

        -- Saved key-pattern searches, per connection (tier badge is derived, not stored)
        CREATE TABLE saved_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_id TEXT NOT NULL,
            name TEXT NOT NULL,
            pattern TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );

        -- Workflow run history (kept even if the connection is later deleted)
        CREATE TABLE workflow_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_id TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            tier TEXT NOT NULL,
            inputs TEXT NOT NULL,
            ok INTEGER NOT NULL,
            text TEXT,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX idx_workflow_runs_action ON workflow_runs(action_id, id);

        CREATE TABLE stats_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            used_memory BIGINT,
            used_memory_peak BIGINT,
            used_memory_rss BIGINT,
            mem_fragmentation_ratio REAL,
            total_keys INTEGER,
            keyspace_hits BIGINT,
            keyspace_misses BIGINT,
            connected_clients INTEGER,
            evicted_keys BIGINT,
            expired_keys BIGINT,
            ops_per_sec INTEGER,
            total_net_input_bytes BIGINT,
            total_net_output_bytes BIGINT,
            used_cpu_sys REAL,
            used_cpu_user REAL,
            total_connections_received BIGINT,
            rejected_connections BIGINT,
            FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_stats_connection_time ON stats_snapshots(connection_id, timestamp);
    `);
};
