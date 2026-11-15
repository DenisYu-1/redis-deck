// Run per-Key commands on the Node that owns each Key: one redis-cli --json
// stdin session per Node (ADR 0002). Keys without a known Node go to the
// Connection's seed in one batch. A MOVED reply (owner unknown, or a reshard
// since the scan) is retried once, batched per owner the replies name.
const { execArgvBatch, getClusterNodes } = require('./redis');

const MOVED = /^MOVED \d+ (\S+):(\d+)/;

// -> Map(group -> { node, keys }); node null means the seed.
function groupByNode(keys, nodeOf) {
    const groups = new Map();
    for (const key of keys) {
        const node = nodeOf(key) || null;
        const group = node ? (node.id ?? `${node.host}:${node.port}`) : '';
        if (!groups.has(group)) {
            groups.set(group, { node, keys: [] });
        }
        groups.get(group).keys.push(key);
    }
    return groups;
}

// One batch per group. Each Key's result lands in `out`; a Key whose reply is
// MOVED goes to `moved` (owner address) when given, else it is an error.
async function runGroups(env, groups, commandsFor, out, moved) {
    await Promise.all(
        [...groups.values()].map(async ({ node, keys }) => {
            const commands = keys.map(commandsFor);
            const replies = await execArgvBatch(commands.flat(), env, node);
            let offset = 0;
            keys.forEach((key, i) => {
                const keyReplies = replies.slice(
                    offset,
                    offset + commands[i].length
                );
                offset += commands[i].length;
                const failed = keyReplies.find((r) => 'error' in r);
                const owner = failed && moved && MOVED.exec(failed.error);
                if (owner) {
                    moved[key] = { host: owner[1], port: Number(owner[2]) };
                } else if (failed) {
                    out[key] = { error: failed.error };
                } else {
                    out[key] = {
                        replies: keyReplies.map((r) => r.value),
                        node
                    };
                }
            });
        })
    );
}

// keyNodes: { [key]: Node } (e.g. from scanClusterNodes); Keys missing from
// it start on the seed. -> { [key]: { replies, node } | { error } }, where
// node is the Node that answered (null: the seed, without a redirect).
async function runOnOwners(env, keys, keyNodes, commandsFor) {
    const out = {};
    const moved = {};
    await runGroups(
        env,
        groupByNode(keys, (key) => keyNodes[key]),
        commandsFor,
        out,
        moved
    );
    const movedKeys = Object.keys(moved);
    if (movedKeys.length > 0) {
        const nodes = await getClusterNodes(env);
        const ownerOf = (key) =>
            nodes.find(
                (n) =>
                    n.host === moved[key].host &&
                    Number(n.port) === moved[key].port
            ) || moved[key];
        await runGroups(
            env,
            groupByNode(movedKeys, ownerOf),
            commandsFor,
            out,
            null
        );
    }
    return out;
}

module.exports = { runOnOwners };
