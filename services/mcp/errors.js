// Error text for the AI client. Service errors can carry redis-cli argv
// (host, user, password) or node-redis socket details, so every config value
// of the Connection is scrubbed before the message leaves the process.
const { getConnection } = require('../database');

const SECRET_FIELDS = ['host', 'username', 'password'];

function secretsOf(connectionId) {
    if (!connectionId) {
        return [];
    }
    let row;
    try {
        row = getConnection(connectionId);
    } catch {
        return [];
    }
    if (!row) {
        return [];
    }
    return SECRET_FIELDS.map((f) => row[f])
        .filter((v) => typeof v === 'string' && v.length > 0)
        .sort((a, b) => b.length - a.length);
}

function safeMessage(error, connectionId) {
    let text = String(error?.message || error || 'Unknown error');
    for (const secret of secretsOf(connectionId)) {
        text = text.split(secret).join('***');
    }
    return text;
}

module.exports = { safeMessage };
