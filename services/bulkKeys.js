// Bulk operations over an explicit list of keys (the Keys page selection).
const { isClusterMode } = require('./redis');
const { getClient } = require('./redisClient');
const keyStore = require('./keyStore');

const MAX_EXPORT = 1000;

const bad = (message) =>
    Object.assign(new Error(message), { status: 400, code: 'BAD_REQUEST' });

function checkKeys(keys) {
    if (
        !Array.isArray(keys) ||
        keys.length === 0 ||
        keys.some((k) => typeof k !== 'string')
    ) {
        throw bad('keys must be a non-empty array of strings');
    }
}

// One pipelined round trip; cluster keys span nodes so those go one by one.
async function pipelined(connectionId, keys, toCommand, perKey) {
    if (await isClusterMode(connectionId)) {
        const out = [];
        for (const key of keys) {
            out.push(await perKey(key));
        }
        return out;
    }
    const multi = (await getClient(connectionId)).multi();
    keys.forEach((key) => multi.addCommand(toCommand(key)));
    return multi.exec();
}

const count = (replies) => replies.filter((r) => Number(r) > 0).length;

// seconds: positive integer to set an expiry, null to PERSIST.
// -> number of keys changed (missing keys are not counted).
async function setTtl(connectionId, keys, seconds) {
    checkKeys(keys);
    if (seconds !== null && !(Number.isInteger(seconds) && seconds > 0)) {
        throw bad('seconds must be a positive integer, or null to persist');
    }
    const replies = await pipelined(
        connectionId,
        keys,
        (k) =>
            seconds === null ? ['PERSIST', k] : ['EXPIRE', k, String(seconds)],
        (k) => keyStore.expireKey(connectionId, k, seconds ?? -1)
    );
    return count(replies);
}

// -> number of keys removed.
async function deleteKeys(connectionId, keys) {
    checkKeys(keys);
    const replies = await pipelined(
        connectionId,
        keys,
        (k) => ['DEL', k],
        (k) => keyStore.deleteKey(connectionId, k)
    );
    return count(replies);
}

const READ_CMD = {
    string: (k) => ['GET', k],
    hash: (k) => ['HGETALL', k],
    list: (k) => ['LRANGE', k, '0', '-1'],
    set: (k) => ['SMEMBERS', k],
    zset: (k) => ['ZRANGE', k, '0', '-1', 'WITHSCORES'],
    stream: (k) => ['XRANGE', k, '-', '+']
};

// Normalise a pipelined reply into the shape GET /keys/:key returns.
function shape(type, reply) {
    if (type === 'zset') {
        return reply.map(([member, score]) => ({
            member,
            score: Number(score)
        }));
    }
    if (type === 'stream') {
        return reply.map(([id, flat]) => ({
            id,
            fields: Object.fromEntries(
                flat.flatMap((v, i) => (i % 2 ? [] : [[v, flat[i + 1]]]))
            )
        }));
    }
    return reply;
}

async function exportPipelined(connectionId, keys) {
    const client = await getClient(connectionId);
    const head = client.multi();
    keys.forEach((k) => {
        head.addCommand(['TYPE', k]);
        head.addCommand(['TTL', k]);
    });
    const meta = await head.exec();
    const present = keys
        .map((key, i) => ({
            key,
            type: String(meta[i * 2]),
            ttl: Number(meta[i * 2 + 1])
        }))
        .filter((e) => e.type !== 'none');
    const readable = present.filter((e) => READ_CMD[e.type]);
    const body = client.multi();
    readable.forEach((e) => body.addCommand(READ_CMD[e.type](e.key)));
    const values = readable.length ? await body.exec() : [];
    const byKey = new Map(readable.map((e, i) => [e.key, values[i]]));
    return present.map((e) => ({
        ...e,
        value: byKey.has(e.key) ? shape(e.type, byKey.get(e.key)) : null
    }));
}

async function exportClustered(connectionId, keys) {
    const out = [];
    for (const key of keys) {
        try {
            const { type, ttl, value } = await keyStore.readKey(
                connectionId,
                key,
                { full: true }
            );
            out.push({ key, type, ttl, value });
        } catch (error) {
            if (error.code !== 'KEY_NOT_FOUND') {
                throw error;
            }
        }
    }
    return out;
}

// -> [{ key, type, ttl, value }]; keys that vanished are skipped.
async function exportKeys(connectionId, keys) {
    if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) {
        throw bad('keys must be an array of strings');
    }
    if (keys.length > MAX_EXPORT) {
        throw bad(`Cannot export more than ${MAX_EXPORT} keys at once`);
    }
    if (keys.length === 0) {
        return [];
    }
    return (await isClusterMode(connectionId))
        ? exportClustered(connectionId, keys)
        : exportPipelined(connectionId, keys);
}

module.exports = { setTtl, deleteKeys, exportKeys, MAX_EXPORT };
