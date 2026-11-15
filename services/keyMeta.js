// Per-page key metadata (type, TTL, memory) for the Keys list.
const { isClusterMode, execArgvBatch, getClusterNodes } = require('./redis');
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

// Size is lazy on clusters (SPEC R4): the Keys list asks keySizes for the
// visible rows only.
const META_COMMANDS = (key) => [
    ['TYPE', key],
    ['TTL', key]
];
const SIZE_COMMANDS = (key) => [['MEMORY', 'USAGE', key]];
const toSize = (size) =>
    size === null || size === undefined ? null : Number(size);
const MOVED = /^MOVED /;

// Per-Key path for a Key without a known Node, or one a reshard moved away:
// keyStore.run finds the owner through MOVED, the rest reuse that Node.
async function fetchOwner(connectionId, commands) {
    const first = await run(connectionId, commands[0]);
    const rest = [];
    for (const argv of commands.slice(1)) {
        rest.push((await run(connectionId, argv, first.node)).result);
    }
    return { replies: [first.result, ...rest], node: first.node };
}

async function nodeIdOf(connectionId, address) {
    if (!address) {
        return undefined;
    }
    const nodes = await getClusterNodes(connectionId);
    return nodes.find(
        (n) => n.host === address.host && Number(n.port) === address.port
    )?.id;
}

// Run `commandsFor(key)` for every Key: one redis-cli --json session per Node
// the Keys came from. -> { [key]: { replies: [...], node: nodeId } }.
// keyNodes: { [key]: { id, host, port } } from scanClusterNodes.
async function fetchPerNode(connectionId, keys, keyNodes, commandsFor) {
    const groups = new Map(); // node id -> { node, keys }
    const out = {};
    const orphans = [];
    for (const key of keys) {
        const node = keyNodes[key];
        if (!node) {
            orphans.push(key);
            continue;
        }
        if (!groups.has(node.id)) {
            groups.set(node.id, { node, keys: [] });
        }
        groups.get(node.id).keys.push(key);
    }

    await Promise.all(
        [...groups.values()].map(async ({ node, keys: nodeKeys }) => {
            const per = nodeKeys.map(commandsFor);
            const replies = await execArgvBatch(per.flat(), connectionId, node);
            let at = 0;
            nodeKeys.forEach((key, i) => {
                const mine = replies.slice(at, at + per[i].length);
                at += per[i].length;
                const failed = mine.find((r) => 'error' in r);
                if (failed && MOVED.test(failed.error)) {
                    orphans.push(key); // resharded since the scan
                    return;
                }
                if (failed) {
                    throw { message: failed.error, code: 'REDIS_ERROR' };
                }
                out[key] = { replies: mine.map((r) => r.value), node: node.id };
            });
        })
    );

    for (const key of orphans) {
        const { replies, node } = await fetchOwner(
            connectionId,
            commandsFor(key)
        );
        out[key] = { replies, node: await nodeIdOf(connectionId, node) };
    }
    return out;
}

// -> { [key]: { type, ttl, size } }  (ttl: -1 no expiry, -2 gone; size bytes|null)
// On a cluster { type, ttl, node: nodeId } with no size (see keySizes). keyNodes: { [key]: Node } from the
// scan; Keys without one are looked up per Key (MOVED-safe).
async function pageMeta(connectionId, keys, keyNodes = {}) {
    if (keys.length === 0) {
        return {};
    }
    const toMeta = ([type, ttl, size]) => ({
        type: String(type),
        ttl: Number(ttl),
        size: toSize(size)
    });
    const meta = {};
    if (await isClusterMode(connectionId)) {
        const perKey = await fetchPerNode(
            connectionId,
            keys,
            keyNodes,
            META_COMMANDS
        );
        for (const key of keys) {
            const [type, ttl] = perKey[key].replies;
            meta[key] = {
                type: String(type),
                ttl: Number(ttl),
                node: perKey[key].node
            };
        }
        return meta;
    }
    const flat = await fetchPipelined(connectionId, keys);
    keys.forEach((key, i) => {
        meta[key] = toMeta(flat.slice(i * 3, i * 3 + 3));
    });
    return meta;
}

// Sizes for Keys the client shows. items: [{ key, node: nodeId }] (node may be
// missing or stale: owner discovery through MOVED). -> { [key]: bytes|null },
// null for a Key that no longer exists. One batched spawn per Node.
async function keySizes(connectionId, items) {
    const keys = [...new Set(items.map((i) => i.key))];
    if (keys.length === 0) {
        return {};
    }
    const sizes = {};
    if (!(await isClusterMode(connectionId))) {
        const client = await getClient(connectionId);
        const multi = client.multi();
        keys.forEach((key) => multi.addCommand(['MEMORY', 'USAGE', key]));
        const flat = await multi.exec();
        keys.forEach((key, i) => (sizes[key] = toSize(flat[i])));
        return sizes;
    }
    const byId = new Map(
        (await getClusterNodes(connectionId)).map((n) => [n.id, n])
    );
    const keyNodes = {};
    for (const { key, node } of items) {
        if (byId.has(node)) {
            keyNodes[key] = byId.get(node);
        }
    }
    const perKey = await fetchPerNode(
        connectionId,
        keys,
        keyNodes,
        SIZE_COMMANDS
    );
    keys.forEach((key) => (sizes[key] = toSize(perKey[key].replies[0])));
    return sizes;
}

module.exports = {
    pageMeta,
    keySizes,
    fetchPerNode,
    matchesTtl,
    TYPES,
    TTL_FILTERS
};
