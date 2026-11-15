const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { migrate } = require('./migrate');
const migrations = require('./migrations');
const { getDataDir } = require('./dataDir');

// Ensure the data directory exists
const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open the SQLite database
// Tests run in parallel jest workers; each gets its own file via REDIS_DECK_DB_FILE
const dbFile = process.env.REDIS_DECK_DB_FILE || 'redis-config.sqlite';
const db = new Database(path.join(dataDir, dbFile));

migrate(db, migrations);

const TIERS = ['local', 'staging', 'production'];

function normalizeTier(tier) {
    return TIERS.includes(tier) ? tier : 'local';
}

// Safety settings as the typed fields the API and UI use (no secrets).
function safetyFields(row) {
    return {
        tier: normalizeTier(row.tier),
        db: row.db ?? 0,
        verifyTls: row.verify_tls !== 0,
        readOnly: row.read_only === 1,
        confirmWrites: row.confirm_writes === 1
    };
}

// Get all connections
function getAllConnections() {
    return db
        .prepare(
            "SELECT id, host, port, username, (password != '') AS has_password, tls, cluster, `order`, tier, db, verify_tls, read_only, confirm_writes FROM connections ORDER BY `order` ASC"
        )
        .all()
        .map(
            ({
                verify_tls,
                read_only,
                confirm_writes,
                tier,
                db: dbNum,
                has_password,
                ...c
            }) => ({
                ...c,
                hasPassword: has_password === 1,
                ...safetyFields({
                    tier,
                    db: dbNum,
                    verify_tls,
                    read_only,
                    confirm_writes
                })
            })
        );
}

// Get a specific connection by ID
function getConnection(id) {
    return db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
}

// Create a new connection
function createConnection(connection) {
    const maxOrderResult = db
        .prepare('SELECT MAX(`order`) as maxOrder FROM connections')
        .get();
    const nextOrder = (maxOrderResult.maxOrder ?? -1) + 1;

    const stmt = db.prepare(`
        INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, db, verify_tls, read_only, confirm_writes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
        connection.id,
        connection.host,
        connection.port,
        connection.username || '',
        connection.password || '',
        connection.tls ? 1 : 0,
        connection.cluster ? 1 : 0,
        connection.order !== undefined ? connection.order : nextOrder,
        normalizeTier(connection.tier),
        Number(connection.db) || 0,
        connection.verifyTls === false ? 0 : 1,
        connection.readOnly ? 1 : 0,
        connection.confirmWrites ? 1 : 0
    );

    return result.changes > 0;
}

// Update an existing connection
function updateConnection(id, connection) {
    const stmt = db.prepare(`
        UPDATE connections
        SET host = ?, port = ?, username = ?, password = ?, tls = ?, cluster = ?, tier = ?, db = ?, verify_tls = ?, read_only = ?, confirm_writes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    const result = stmt.run(
        connection.host,
        connection.port,
        connection.username || '',
        connection.password || '',
        connection.tls ? 1 : 0,
        connection.cluster ? 1 : 0,
        normalizeTier(connection.tier),
        Number(connection.db) || 0,
        connection.verifyTls === false ? 0 : 1,
        connection.readOnly ? 1 : 0,
        connection.confirmWrites ? 1 : 0,
        id
    );

    return result.changes > 0;
}

// Delete a connection
function deleteConnection(id) {
    const result = db.transaction(() => {
        db.prepare('DELETE FROM saved_searches WHERE connection_id = ?').run(
            id
        );
        return db.prepare('DELETE FROM connections WHERE id = ?').run(id);
    })();
    return result.changes > 0;
}

// Update connection order
function updateConnectionOrder(connectionIds) {
    const updateStmt = db.prepare(
        'UPDATE connections SET `order` = ? WHERE id = ?'
    );
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
        cluster: connection.cluster === 1,
        ...safetyFields(connection)
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
    safetyFields,
    getDatabase,
    db
};
