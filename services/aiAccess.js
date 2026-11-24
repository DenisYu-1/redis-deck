// AI access (ADR 0005): what AI clients may do per Connection. Columns:
// keys, values, write, workflows, ask. Only keys/values take effect so far.
// A Connection without a row (e.g. inserted by a test) reads as Tier defaults.
const { getDatabase, getConnection, normalizeTier } = require('./database');
const { defaultAccess } = require('./aiAccessDefaults');

const FIELDS = ['keys', 'values', 'write', 'workflows', 'ask'];
const NEEDS_KEYS = ['values', 'write', 'workflows'];
// Column names in ai_access (values/keys are awkward SQL words).
const COLUMN = {
    keys: 'see_keys',
    values: 'see_values',
    write: 'write',
    workflows: 'workflows',
    ask: 'ask'
};

class AiAccessError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// Apply the rules that hold whatever was saved.
function effective(access, { tier, readOnly }) {
    const keys = access.keys;
    return {
        keys,
        values: keys && access.values,
        write: keys && !readOnly && access.write,
        workflows: keys && !readOnly && access.workflows,
        ask: tier === 'production' ? true : access.ask
    };
}

function storedAccess(connectionId) {
    const row = getDatabase()
        .prepare('SELECT * FROM ai_access WHERE connection_id = ?')
        .get(connectionId);
    if (!row) return null;
    return Object.fromEntries(FIELDS.map((f) => [f, row[COLUMN[f]] === 1]));
}

const safetyOf = (conn) => ({
    tier: normalizeTier(conn.tier),
    readOnly: conn.read_only === 1
});

// AI access of a Connection (effective), or null for an unknown one.
function getAiAccess(connectionId) {
    const conn = getConnection(connectionId);
    if (!conn) return null;
    const safety = safetyOf(conn);
    return effective(
        storedAccess(connectionId) ?? defaultAccess(safety),
        safety
    );
}

// One entry per Connection for the AI access grid.
function listAiAccess() {
    return getDatabase()
        .prepare('SELECT id FROM connections ORDER BY `order` ASC')
        .all()
        .map(({ id }) => {
            const conn = getConnection(id);
            return {
                id,
                ...safetyOf(conn),
                ...getAiAccess(id)
            };
        });
}

// patch: any of FIELDS as booleans. Saves and returns the effective access.
// Throws AiAccessError (400 bad input / rule broken, 404 unknown Connection).
function setAiAccess(connectionId, patch) {
    const conn = getConnection(connectionId);
    if (!conn) {
        throw new AiAccessError(`Connection '${connectionId}' not found`, 404);
    }
    for (const [field, value] of Object.entries(patch)) {
        if (!FIELDS.includes(field) || typeof value !== 'boolean') {
            throw new AiAccessError(`${field} must be a known boolean field`);
        }
    }
    const safety = safetyOf(conn);
    const next = {
        ...(storedAccess(connectionId) ?? defaultAccess(safety)),
        ...patch
    };
    if (patch.keys === false) {
        NEEDS_KEYS.forEach((f) => (next[f] = false));
    }
    const wrongOn = NEEDS_KEYS.find((f) => patch[f] === true && !next.keys);
    if (wrongOn) {
        throw new AiAccessError(`${wrongOn} needs keys`);
    }
    if (safety.readOnly) {
        const blocked = ['write', 'workflows'].find((f) => patch[f] === true);
        if (blocked) {
            throw new AiAccessError(
                `${blocked} is not available on a Read-only Connection`
            );
        }
    }
    getDatabase()
        .prepare(
            `INSERT INTO ai_access (connection_id, see_keys, see_values, write, workflows, ask)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(connection_id) DO UPDATE SET see_keys = excluded.see_keys,
                 see_values = excluded.see_values, write = excluded.write,
                 workflows = excluded.workflows, ask = excluded.ask`
        )
        .run(connectionId, ...FIELDS.map((f) => (next[f] ? 1 : 0)));
    return getAiAccess(connectionId);
}

module.exports = {
    AiAccessError,
    getAiAccess,
    listAiAccess,
    setAiAccess
};
