// Per-page key metadata (type, TTL, memory) for the Keys list.
const { isClusterMode } = require('./redis');
const { run } = require('./keyStore');
const { getClient } = require('./redisClient');

const TYPES = ['string', 'hash', 'list', 'set', 'zset', 'stream', 'json'];
const TTL_FILTERS = ['any', 'has', 'none', 'lt1h'];

function matchesTtl(filter, ttl) {
    switch (filter) {
        case 'has':
            return ttl >= 0;
        case 'none':
            return ttl === -1;
        case 'lt1h':
            return ttl >= 0 && ttl < 3600;
        default:
            return true;
    }
}

// One pipelined round trip on the persistent socket.
async function fetchPipelined(connectionId, keys) {
    const client = await getClient(connectionId);
    const multi = client.multi();
    for (const key of keys) {
        multi.addCommand(['TYPE', key]);
        multi.addCommand(['TTL', key]);
        multi.addCommand(['MEMORY', 'USAGE', key]);
    }
    return multi.exec();
}

// Cluster keys live on different nodes, so a single pipeline cannot serve them.
// ponytail: per-key redis-cli calls; slow but correct. Replace with per-node pipelines if needed.
async function fetchCluster(connectionId, keys) {
    const out = [];
    for (const key of keys) {
        // MOVED-safe: the first call finds the owning node, the rest reuse it.
        const first = await run(connectionId, ['TYPE', key]);
        const { node } = first;
        out.push(
            String(first.result),
            (await run(connectionId, ['TTL', key], node)).result,
            (await run(connectionId, ['MEMORY', 'USAGE', key], node)).result
        );
    }
    return out;
}

// -> { [key]: { type, ttl, size } }  (ttl: -1 no expiry, -2 gone; size bytes|null)
async function pageMeta(connectionId, keys) {
    if (keys.length === 0) {
        return {};
    }
    const flat = (await isClusterMode(connectionId))
        ? await fetchCluster(connectionId, keys)
        : await fetchPipelined(connectionId, keys);
    const meta = {};
    keys.forEach((key, i) => {
        const [type, ttl, size] = flat.slice(i * 3, i * 3 + 3);
        meta[key] = {
            type: String(type),
            ttl: Number(ttl),
            size: size === null || size === undefined ? null : Number(size)
        };
    });
    return meta;
}

module.exports = { pageMeta, matchesTtl, TYPES, TTL_FILTERS };
