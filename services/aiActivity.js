// AI activity: the log of MCP writes and refused write attempts, plus the
// "Log AI operations" setting. The setting is read from SQLite on every
// record, so a --mcp process picks up a change without a restart.
const { getDatabase } = require('./database');

const LOG_SETTING = 'log_ai_operations';
const DAY_MS = 24 * 60 * 60 * 1000;

// What happened to a logged write. Mirrored by AiActivityResult in the client.
const RESULTS = Object.freeze({
    done: 'done', // ran
    denied: 'denied', // the user said no (or did not answer)
    blocked: 'blocked', // not allowed at all (Read-only, unknown Connection)
    failed: 'failed' // ran and threw
});

function isLoggingEnabled() {
    const row = getDatabase()
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(LOG_SETTING);
    return row ? row.value === '1' : true;
}

function setLoggingEnabled(enabled) {
    getDatabase()
        .prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(LOG_SETTING, enabled ? '1' : '0');
}

// result: one of RESULTS. No-op when logging is off.
function recordActivity({
    time,
    client,
    connectionId,
    operation,
    target,
    result,
    error
}) {
    if (!isLoggingEnabled()) return;
    getDatabase()
        .prepare(
            `INSERT INTO ai_activity (created_at, client, connection_id, operation, target, result, error)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            time,
            client,
            String(connectionId ?? ''),
            operation,
            target ?? null,
            result,
            error ?? null
        );
}

// Newest first. Returns { entries, total } (total = all matching entries).
function listActivity({ connectionId, limit = 50, offset = 0 } = {}) {
    const where = connectionId ? 'WHERE connection_id = ?' : '';
    const params = connectionId ? [connectionId] : [];
    const db = getDatabase();
    const entries = db
        .prepare(
            `SELECT id, created_at AS time, client, connection_id AS connectionId,
                    operation, target, result, error
             FROM ai_activity ${where}
             ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
    const { total } = db
        .prepare(`SELECT COUNT(*) AS total FROM ai_activity ${where}`)
        .get(...params);
    return { entries, total };
}

// Removes entries older than daysToKeep. Returns the number removed.
function cleanupOldActivity(daysToKeep = 30, now = Date.now()) {
    return getDatabase()
        .prepare('DELETE FROM ai_activity WHERE created_at < ?')
        .run(now - daysToKeep * DAY_MS).changes;
}

module.exports = {
    RESULTS,
    isLoggingEnabled,
    setLoggingEnabled,
    recordActivity,
    listActivity,
    cleanupOldActivity
};
