// Data version 2: the AI activity log and a key/value table for app settings
// (the "Log AI operations" toggle).
module.exports = function up(db) {
    db.exec(`
        -- MCP writes and refused write attempts (reads are never logged)
        CREATE TABLE ai_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER NOT NULL, -- ms since epoch
            client TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            target TEXT, -- the Key, or the Workflow fullId
            result TEXT NOT NULL CHECK (result IN ('done', 'denied', 'blocked', 'failed')),
            error TEXT
        );
        CREATE INDEX idx_ai_activity_connection ON ai_activity(connection_id, created_at);
        CREATE INDEX idx_ai_activity_time ON ai_activity(created_at);

        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
};
