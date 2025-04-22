const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open the SQLite database
const db = new Database(path.join(dataDir, 'redis-config.sqlite'));

// Initialize database schema
function initializeDatabase() {
    // First, check if the database already exists and has the old schema
    let hasOldSchema = false;
    try {
        // Check if the name column exists in the connections table
        const tableInfo = db.prepare('PRAGMA table_info(connections)').all();
        hasOldSchema = tableInfo.some(col => col.name === 'name');
    } catch {
        // Table doesn't exist yet, so we'll create it with the new schema
    }

    // If we have the old schema, migrate to new schema
    if (hasOldSchema) {
        // Create a new table without the name column
        db.exec(`
            CREATE TABLE connections_new (
                id TEXT PRIMARY KEY,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT,
                password TEXT,
                tls INTEGER DEFAULT 0,
                cluster INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Copy data from old table to new table
        db.exec(`
            INSERT INTO connections_new (id, host, port, username, password, tls, cluster, created_at, updated_at)
            SELECT id, host, port, username, password, tls, 0 as cluster, created_at, updated_at FROM connections
        `);

        // Drop old table
        db.exec('DROP TABLE connections');

        // Rename new table to the original name
        db.exec('ALTER TABLE connections_new RENAME TO connections');
    } else {
        // Create connections table if it doesn't exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT,
                password TEXT,
                tls INTEGER DEFAULT 0,
                cluster INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // Ensure 'cluster' column exists for older installs without full migration
    try {
        const tableInfo = db.prepare('PRAGMA table_info(connections)').all();
        const hasCluster = tableInfo.some(col => col.name === 'cluster');
        if (!hasCluster) {
            db.exec('ALTER TABLE connections ADD COLUMN cluster INTEGER DEFAULT 0');
        }
    } catch {
        // ignore
    }

    // Ensure 'order' column exists for drag and drop ordering
    try {
        const tableInfo = db.prepare('PRAGMA table_info(connections)').all();
        const hasOrder = tableInfo.some(col => col.name === 'order');
        if (!hasOrder) {
            db.exec('ALTER TABLE connections ADD COLUMN `order` INTEGER DEFAULT 0');

            // Set initial order values based on existing connections
            const connections = db.prepare('SELECT id FROM connections').all();
            const updateOrderStmt = db.prepare('UPDATE connections SET `order` = ? WHERE id = ?');
            connections.forEach((conn, index) => {
                updateOrderStmt.run(index, conn.id);
            });
        }
    } catch {
        // ignore
    }

    // Create stats_snapshots table for statistics collection
    db.exec(`
        CREATE TABLE IF NOT EXISTS stats_snapshots (
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
        )
    `);

    // Create index for efficient queries on stats
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_stats_connection_time 
        ON stats_snapshots(connection_id, timestamp)
    `);

    // Add new columns to existing stats_snapshots table if they don't exist
    try {
        const tableInfo = db.prepare('PRAGMA table_info(stats_snapshots)').all();
        const columns = tableInfo.map(col => col.name);
        
        const newColumns = [
            { name: 'ops_per_sec', type: 'INTEGER' },
            { name: 'total_net_input_bytes', type: 'BIGINT' },
            { name: 'total_net_output_bytes', type: 'BIGINT' },
            { name: 'used_cpu_sys', type: 'REAL' },
            { name: 'used_cpu_user', type: 'REAL' },
            { name: 'total_connections_received', type: 'BIGINT' },
            { name: 'rejected_connections', type: 'BIGINT' }
        ];
        
        for (const col of newColumns) {
            if (!columns.includes(col.name)) {
                db.exec(`ALTER TABLE stats_snapshots ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added column ${col.name} to stats_snapshots`);
            }
        }
    } catch (error) {
        console.error('Error adding new columns to stats_snapshots:', error);
    }

}

// Initialize the database
initializeDatabase();

// Get all connections
function getAllConnections() {
    return db.prepare('SELECT id, host, port, username, tls, cluster, `order` FROM connections ORDER BY `order` ASC').all();
}

// Get a specific connection by ID
function getConnection(id) {
    return db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
}

// Create a new connection
function createConnection(connection) {
    const maxOrderResult = db.prepare('SELECT MAX(`order`) as maxOrder FROM connections').get();
    const nextOrder = (maxOrderResult.maxOrder ?? -1) + 1;

    const stmt = db.prepare(`
        INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
        connection.id,
        connection.host,
        connection.port,
        connection.username || '',
        connection.password || '',
        connection.tls ? 1 : 0,
        connection.cluster ? 1 : 0,
        connection.order !== undefined ? connection.order : nextOrder
    );

    return result.changes > 0;
}

// Update an existing connection
function updateConnection(id, connection) {
    const stmt = db.prepare(`
        UPDATE connections
        SET host = ?, port = ?, username = ?, password = ?, tls = ?, cluster = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const result = stmt.run(
        connection.host,
        connection.port,
        connection.username || '',
        connection.password || '',
        connection.tls ? 1 : 0,
        connection.cluster ? 1 : 0,
        id
    );

    return result.changes > 0;
}

// Delete a connection
function deleteConnection(id) {
    const stmt = db.prepare('DELETE FROM connections WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
}

// Update connection order
function updateConnectionOrder(connectionIds) {
    const updateStmt = db.prepare('UPDATE connections SET `order` = ? WHERE id = ?');
    const transaction = db.transaction((ids) => {
        ids.forEach((id, index) => {
            updateStmt.run(index, id);
        });
    });

    transaction(connectionIds);
    return true;
}

// Generate a config object compatible with the Redis client
function getConnectionConfig(id) {
    const connection = getConnection(id);

    if (!connection) {
        throw new Error(`Connection '${id}' not found`);
    }

    return {
        host: connection.host,
        port: connection.port,
        username: connection.username || undefined,
        password: connection.password || undefined,
        tls: connection.tls === 1,
        cluster: connection.cluster === 1
    };
}

// Get database instance for direct queries (e.g., stats collector)
function getDatabase() {
    return db;
}

module.exports = {
    getAllConnections,
    getConnection,
    createConnection,
    updateConnection,
    deleteConnection,
    updateConnectionOrder,
    getConnectionConfig,
    getDatabase,
    db
};
