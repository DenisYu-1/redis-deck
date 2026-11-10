// Key-level operations. Callers pass plain JS values and get plain JS values
// back; quoting, MOVED redirects and redis-cli output parsing stay in here.
const { execArgv } = require('./redis');

const MOVED = /^MOVED\s+\d+\s+(.*):(\d+)/;
const LIST_PREVIEW = 1000;

function fail(message, code, status) {
    return Object.assign(new Error(message), { code, status });
}

// Run a command; on a cluster MOVED reply retry once on the owning node.
// Returns { result, node } so follow-up commands can reuse that node.
async function run(connectionId, argv, node = null) {
    try {
        return { result: await execArgv(argv, connectionId, node), node };
    } catch (error) {
        const m = !node && MOVED.exec(error.message || '');
        if (!m) {
            throw error;
        }
        const target = { host: m[1], port: parseInt(m[2]) };
        return {
            result: await execArgv(argv, connectionId, target),
            node: target
        };
    }
}

async function readValue(type, key, connectionId, node, full) {
    const exec = (...argv) => execArgv(argv, connectionId, node);
    switch (type) {
        case 'string':
            return exec('GET', key);
        case 'hash':
            return (await exec('HGETALL', key)) || {};
        case 'list':
            return exec('LRANGE', key, 0, full ? -1 : LIST_PREVIEW - 1);
        case 'set':
            return exec('SMEMBERS', key);
        case 'zset':
            return (await exec('ZRANGE', key, 0, -1, 'WITHSCORES')).map(
                ([member, score]) => ({ member, score })
            );
        case 'stream':
            return (
                await exec('XRANGE', key, '-', '+', 'COUNT', LIST_PREVIEW)
            ).map(([id, flat]) => ({
                id,
                fields: Object.fromEntries(pairs2(flat))
            }));
        default:
            return null;
    }
}

function pairs2(flat) {
    const out = [];
    for (let i = 0; i < flat.length; i += 2) {
        out.push([flat[i], flat[i + 1]]);
    }
    return out;
}

// -> { key, type, ttl, value, nodeId? }. Throws 'Key not found'.
// value shape by type: string -> string, hash -> {field: value},
// list/set -> string[], zset -> [{member, score}], stream -> [{id, fields}].
async function readKey(connectionId, key, { full = false } = {}) {
    const { result: type, node } = await run(connectionId, ['TYPE', key]);
    if (type === 'none') {
        throw fail('Key not found', 'KEY_NOT_FOUND', 404);
    }
    const ttl = await execArgv(['TTL', key], connectionId, node);
    const value = await readValue(type, key, connectionId, node, full);
    return {
        key,
        type,
        ttl,
        value,
        ...(node && { nodeId: `${node.host}:${node.port}` })
    };
}

const LENGTH_CMD = {
    string: 'STRLEN',
    hash: 'HLEN',
    list: 'LLEN',
    set: 'SCARD',
    zset: 'ZCARD',
    stream: 'XLEN'
};

// -> { type, encoding, idle, memory, length }. Fields Redis cannot answer
// (IDLETIME under an LFU policy, MEMORY USAGE, JSON length) are null.
async function readMeta(connectionId, key) {
    const { result: type, node } = await run(connectionId, ['TYPE', key]);
    if (type === 'none') {
        throw fail('Key not found', 'KEY_NOT_FOUND', 404);
    }
    const ask = (...argv) =>
        execArgv(argv, connectionId, node).catch(() => null);
    const lengthCmd = LENGTH_CMD[type];
    const [encoding, idle, memory, length] = await Promise.all([
        ask('OBJECT', 'ENCODING', key),
        ask('OBJECT', 'IDLETIME', key),
        ask('MEMORY', 'USAGE', key),
        lengthCmd ? ask(lengthCmd, key) : null
    ]);
    return { type, encoding, idle, memory, length };
}

async function keyExists(connectionId, key) {
    return (await run(connectionId, ['EXISTS', key])).result === 1;
}

// Replace the whole key. ttl in seconds, > 0 to set an expiry.
async function writeKey(connectionId, key, type, value, ttl = 0) {
    let add;
    if (type === 'string') {
        const str =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
        add = ['SET', key, str, ...(ttl > 0 ? ['EX', ttl] : [])];
    } else {
        const items = {
            hash: () => Object.entries(value || {}).flat(),
            list: () => (value || []).map(String),
            set: () => (value || []).map(String),
            zset: () =>
                (value || []).flatMap(({ member, score }) => {
                    if (typeof score !== 'number' || member === undefined) {
                        throw fail(
                            'Each zset entry needs member and numeric score',
                            'BAD_VALUE',
                            400
                        );
                    }
                    return [score, String(member)];
                })
        }[type];
        if (!items) {
            throw fail(`Unsupported type: ${type}`, 'BAD_TYPE', 400);
        }
        const args = items();
        if (args.length === 0) {
            throw fail('Value must not be empty', 'BAD_VALUE', 400);
        }
        const cmd = { hash: 'HSET', list: 'RPUSH', set: 'SADD', zset: 'ZADD' }[
            type
        ];
        // DEL first so members removed in the editor really go away.
        const { node } = await run(connectionId, ['DEL', key]);
        await execArgv([cmd, key, ...args], connectionId, node);
        if (ttl > 0) {
            await execArgv(['EXPIRE', key, ttl], connectionId, node);
        }
        return { node };
    }
    return run(connectionId, add).then(({ node }) => ({ node }));
}

async function deleteKey(connectionId, key) {
    return (await run(connectionId, ['DEL', key])).result;
}

async function renameKey(connectionId, oldKey, newKey) {
    return (await run(connectionId, ['RENAME', oldKey, newKey])).result;
}

// seconds < 0 removes the expiry.
async function expireKey(connectionId, key, seconds) {
    const argv = seconds < 0 ? ['PERSIST', key] : ['EXPIRE', key, seconds];
    return (await run(connectionId, argv)).result;
}

// Copy across (or within) connections via the structured value.
async function copyKey(connectionId, key, targetConnectionId, targetKey) {
    const { type, ttl, value } = await readKey(connectionId, key, {
        full: true
    });
    await writeKey(targetConnectionId, targetKey, type, value, ttl);
}

module.exports = {
    readKey,
    readMeta,
    keyExists,
    writeKey,
    deleteKey,
    renameKey,
    expireKey,
    copyKey
};
