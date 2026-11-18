// Error text for the AI client. Service errors can carry redis-cli argv
// (host, port, user, password), node-redis socket details or URLs, so every
// config value of the Connection is scrubbed before the message leaves the
// process: as written, URL-encoded and JSON-escaped.
const { getConnection } = require('../database');

const MASK = '***';
const TEXT_FIELDS = ['host', 'username', 'password'];

// The forms a value can take inside an error message.
const variantsOf = (value) => [
    value,
    encodeURIComponent(value),
    JSON.stringify(value).slice(1, -1)
];

function connectionOf(connectionId) {
    if (!connectionId) {
        return null;
    }
    try {
        return getConnection(connectionId) ?? null;
    } catch {
        return null;
    }
}

function safeMessage(error, connectionId) {
    let text = String(error?.message || error || 'Unknown error');
    const row = connectionOf(connectionId);
    if (!row) {
        return text;
    }
    const secrets = TEXT_FIELDS.map((f) => row[f])
        .filter((v) => typeof v === 'string' && v.length > 0)
        .flatMap(variantsOf)
        // Longest first, so a value inside another is not masked half-way.
        .sort((a, b) => b.length - a.length);
    for (const secret of new Set(secrets)) {
        text = text.split(secret).join(MASK);
    }
    const port = Number(row.port);
    if (Number.isInteger(port) && port > 0) {
        // Whole numbers only: 6379 must not mask part of 63790.
        text = text.replace(new RegExp(`(?<!\\d)${port}(?!\\d)`, 'g'), MASK);
    }
    return text;
}

module.exports = { safeMessage };
