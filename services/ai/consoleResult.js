// Masks a Console reply before it reaches a model. A reply carries no field
// names of its own (HGETALL is a flat list, HGET a bare string), so the command
// decides how it is read. Anything not understood is withheld.
const { lookupCommand } = require('../console/commands');
const { tokenize } = require('../console/tokenize');
const { getHiddenFields, MASK } = require('../hiddenFields');

// Counts, TTLs, types and write acknowledgements: single replies, no values.
const NO_VALUES = new Set([
    'TYPE',
    'TTL',
    'PTTL',
    'EXISTS',
    'STRLEN',
    'HLEN',
    'LLEN',
    'ZCARD',
    'DBSIZE',
    'MEMORY USAGE',
    'OBJECT ENCODING',
    'OBJECT IDLETIME',
    'OBJECT FREQ',
    'SET',
    'HSET',
    'HDEL',
    'LPUSH',
    'RPUSH',
    'DEL',
    'UNLINK',
    'EXPIRE',
    'PERSIST',
    'RENAME',
    'INCR',
    'INCRBY',
    'DECR',
    'MSET',
    'SETEX',
    'PEXPIRE',
    'EXPIREAT',
    'HEXISTS',
    'SCARD',
    'SISMEMBER',
    'SADD',
    'SREM',
    'ZADD',
    'ZREM',
    'ZSCORE',
    'ZRANK',
    'LREM',
    'LSET',
    'XLEN',
    'XADD',
    'XDEL'
]);
// Names, and the server figures get_info already gives.
const NAMES_ONLY = new Set([
    'KEYS',
    'SCAN',
    'RANDOMKEY',
    'HKEYS',
    'INFO',
    'TIME'
]);
// Replies made of values.
const VALUES = new Set([
    'GET',
    'MGET',
    'ECHO',
    'PING',
    'LINDEX',
    'LRANGE',
    'LPOP',
    'RPOP',
    'SMEMBERS',
    'SSCAN',
    'ZRANGE',
    'ZSCAN'
]);
// CONFIG GET parameters that hold or name credentials.
const SECRET_CONFIG = /pass|auth|secret|token|user|acl/i;
const PHP_SERIALIZED = /(?:^|\|)\s*[aOCs]:\d+:/;

const WITHHELD = Symbol('withheld');

function parseJson(text) {
    const first = text.trimStart()[0];
    if (first !== '{' && first !== '[') return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// Like hiddenFields.maskValue, but stricter: text that cannot be taken apart is
// masked when it might hold a hidden field, as is a list that names one (a flat
// field, value layout).
function maskData(node, hidden) {
    if (hidden.size === 0) return node;
    if (typeof node === 'string') {
        const json = parseJson(node);
        if (json !== undefined) {
            return JSON.stringify(maskData(json, hidden));
        }
        const lower = node.toLowerCase();
        const unsure =
            PHP_SERIALIZED.test(node) ||
            [...hidden].some((name) => lower.includes(name));
        return unsure ? MASK : node;
    }
    if (Array.isArray(node)) {
        const namesOne = node.some(
            (item) => typeof item === 'string' && hidden.has(item.toLowerCase())
        );
        return namesOne ? MASK : node.map((item) => maskData(item, hidden));
    }
    if (node && typeof node === 'object') {
        return Object.fromEntries(
            Object.entries(node).map(([k, v]) => [
                k,
                hidden.has(k.toLowerCase()) ? MASK : maskData(v, hidden)
            ])
        );
    }
    return node;
}

// [name, value] pairs from a flat, nested or map reply; null for anything else.
function pairsOf(reply) {
    if (!reply || typeof reply !== 'object') return null;
    if (!Array.isArray(reply)) return Object.entries(reply);
    if (reply.every((p) => Array.isArray(p) && p.length === 2)) return reply;
    if (reply.length % 2 !== 0 || reply.some(Array.isArray)) return null;
    return Array.from({ length: reply.length / 2 }, (_, i) =>
        reply.slice(i * 2, i * 2 + 2)
    );
}

const maskPairs = (reply, isSecret, mask) =>
    pairsOf(reply)?.map(([name, value]) => [
        name,
        isSecret(String(name)) ? MASK : mask(value)
    ]) ?? WITHHELD;

function maskReply(argv, reply, hidden) {
    const { name, entry } = lookupCommand(argv);
    if (!entry) return WITHHELD;
    const mask = (value) => maskData(value, hidden);
    const isHidden = (field) => hidden.has(field.toLowerCase());
    // SET ... GET answers with the old value.
    if (name === 'SET' && argv.slice(3).some((w) => /^get$/i.test(w))) {
        return mask(reply);
    }
    if (NO_VALUES.has(name)) {
        return reply && typeof reply === 'object' ? WITHHELD : reply;
    }
    if (NAMES_ONLY.has(name)) return reply;
    if (VALUES.has(name)) return mask(reply);
    // HINCRBY answers with the field's new value.
    if (name === 'HGET' || name === 'HINCRBY') {
        return isHidden(argv[2] ?? '') && reply !== null ? MASK : mask(reply);
    }
    if (name === 'HMGET') {
        if (!Array.isArray(reply)) return WITHHELD;
        return reply.map((value, i) =>
            isHidden(argv[i + 2] ?? '') && value !== null ? MASK : mask(value)
        );
    }
    // A slice can hold a secret without the field name that gives it away.
    if (name === 'GETRANGE') return hidden.size === 0 ? reply : WITHHELD;
    if (name === 'HGETALL') return maskPairs(reply, isHidden, mask);
    if (name === 'HSCAN') {
        if (!Array.isArray(reply)) return WITHHELD;
        const [cursor, items] = reply;
        // NOVALUES: field names only
        if (argv.slice(3).some((w) => /^novalues$/i.test(w))) return reply;
        const fields = maskPairs(items, isHidden, mask);
        return fields === WITHHELD ? WITHHELD : [cursor, fields];
    }
    if (name === 'XRANGE') {
        if (!Array.isArray(reply)) return WITHHELD;
        const entries = reply.map((entry) => {
            const fields = maskPairs(entry?.[1], isHidden, mask);
            return fields === WITHHELD ? WITHHELD : [entry[0], fields];
        });
        return entries.includes(WITHHELD) ? WITHHELD : entries;
    }
    if (name === 'CONFIG GET') {
        const isSecret = (p) => SECRET_CONFIG.test(p) || isHidden(p);
        return maskPairs(reply, isSecret, (value) => value);
    }
    return WITHHELD;
}

/**
 * The reply of a Console statement, safe to give a model, or undefined when it
 * has to be withheld. kind: the Console result's.
 */
function maskConsoleResult({ text, kind, reply }, names = getHiddenFields()) {
    const hidden = new Set(names);
    if (kind === 'not-run') return null;
    // An error may quote the arguments or a value.
    if (kind === 'error') {
        return typeof reply === 'string' ? maskData(reply, hidden) : undefined;
    }
    const masked = maskReply(tokenize(text), reply, hidden);
    return masked === WITHHELD ? undefined : masked;
}

module.exports = { maskConsoleResult };
