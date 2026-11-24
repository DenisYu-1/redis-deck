// Data version 4: AI activity logs every call. Adds the request args, the
// response and the duration, and renames the results (done -> ok, failed ->
// error). SQLite cannot alter a CHECK, so the table is rebuilt.
module.exports = function up(db) {
    db.exec(`
        CREATE TABLE ai_activity_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER NOT NULL, -- ms since epoch
            client TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            operation TEXT NOT NULL, -- the tool
            target TEXT, -- the Key, or the Workflow fullId
            result TEXT NOT NULL CHECK (result IN ('ok', 'denied', 'blocked', 'error')),
            error TEXT,
            args TEXT, -- masked JSON
            response TEXT, -- masked JSON, capped
            duration_ms INTEGER
        );
        INSERT INTO ai_activity_new (id, created_at, client, connection_id, operation, target, result, error)
        SELECT id, created_at, client, connection_id, operation, target,
               CASE result WHEN 'done' THEN 'ok' WHEN 'failed' THEN 'error' ELSE result END,
               error
        FROM ai_activity;
        DROP TABLE ai_activity;
        ALTER TABLE ai_activity_new RENAME TO ai_activity;
        CREATE INDEX idx_ai_activity_connection ON ai_activity(connection_id, created_at);
        CREATE INDEX idx_ai_activity_time ON ai_activity(created_at);
    `);
};
