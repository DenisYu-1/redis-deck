// AI activity: the log of MCP writes and refused write attempts, plus the
// "Log AI operations" setting. The setting is read from SQLite on every
// record, so a --mcp process picks up a change without a restart.
const { getDatabase } = require('./database');
const { maskValue } = require('./hiddenFields');

const LOG_SETTING = 'log_ai_operations';
const DAY_MS = 24 * 60 * 60 * 1000;

// What happened to a logged write. Mirrored by AiActivityResult in the client.
const RESULTS = Object.freeze({
    ok: 'ok', // ran
    denied: 'denied', // the user said no (or did not answer)
    blocked: 'blocked', // not allowed at all (Read-only, hidden, switched off)
    error: 'error' // ran and threw
});

const RESPONSE_CAP = 4096;

// clientInfo.name of the known AI clients -> the label shown. Others stay raw.
const CLIENT_LABELS = [
    [/^claude-code/i, 'Claude Code'],
    [/^claude/i, 'Claude Desktop'],
    [/^codex/i, 'Codex'],
    [/^cursor/i, 'Cursor']
];

function clientLabel(name) {
    return CLIENT_LABELS.find(([re]) => re.test(name))?.[1] ?? name;
}

// Masked JSON text, cut at the cap. undefined -> null.
function storedJson(value, cap = Infinity) {
    if (value === undefined) return null;
    const text = JSON.stringify(maskValue(value));
    return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

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

// result: one of RESULTS. args and response are masked with the hidden field
// list before they are stored; the response is capped. No-op when logging is off.
function recordActivity({
    time,
    client,
    connectionId,
    operation,
    target,
    result,
    error,
    args,
    response,
    durationMs
}) {
    if (!isLoggingEnabled()) return;
    getDatabase()
        .prepare(
            `INSERT INTO ai_activity (created_at, client, connection_id, operation, target, result, error, args, response, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            time,
            client,
            String(connectionId ?? ''),
            operation,
            target ?? null,
            result,
            error ?? null,
            storedJson(args),
            storedJson(response, RESPONSE_CAP),
            durationMs ?? null
        );
}

// Newest first. Filters: connectionId, client (exact), result (one of RESULTS),
// q (substring of tool, Key or Connection). Returns { entries, total } (total =
// all matching entries).
function listActivity({
    connectionId,
    client,
    result,
    q,
    limit = 50,
    offset = 0
} = {}) {
    const conds = [];
    const params = [];
    if (connectionId) {
        conds.push('connection_id = ?');
        params.push(connectionId);
    }
    if (client) {
        conds.push('client = ?');
        params.push(client);
    }
    if (result) {
        conds.push('result = ?');
        params.push(result);
    }
    if (q) {
        const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        conds.push(
            "(operation LIKE ? ESCAPE '\\' OR target LIKE ? ESCAPE '\\' OR connection_id LIKE ? ESCAPE '\\')"
        );
        params.push(like, like, like);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const db = getDatabase();
    const entries = db
        .prepare(
            `SELECT id, created_at AS time, client, connection_id AS connectionId,
                    operation, target, result, error, args, response,
                    duration_ms AS durationMs
             FROM ai_activity ${where}
             ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
    const { total } = db
        .prepare(`SELECT COUNT(*) AS total FROM ai_activity ${where}`)
        .get(...params);
    return { entries, total };
}

// Each distinct client with the time of its last call, most recent first.
function listClients() {
    return getDatabase()
        .prepare(
            `SELECT client, MAX(created_at) AS lastCallAt FROM ai_activity
             GROUP BY client ORDER BY lastCallAt DESC`
        )
        .all();
}

// Deletes every entry. Returns the number removed.
function clearActivity() {
    return getDatabase().prepare('DELETE FROM ai_activity').run().changes;
}

// Removes entries older than daysToKeep. Returns the number removed.
function cleanupOldActivity(daysToKeep = 30, now = Date.now()) {
    return getDatabase()
        .prepare('DELETE FROM ai_activity WHERE created_at < ?')
        .run(now - daysToKeep * DAY_MS).changes;
}

module.exports = {
    RESULTS,
    clientLabel,
    isLoggingEnabled,
    setLoggingEnabled,
    recordActivity,
    listActivity,
    listClients,
    clearActivity,
    cleanupOldActivity
};
