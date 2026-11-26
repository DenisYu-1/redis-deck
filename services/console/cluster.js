// Console statements on a clustered Connection: one `redis-cli -c` each (ADR
// 0002), with replies shaped like the standalone ones. Nothing here logs.
const { execArgvRedirected, fetchClusterNodes } = require('../redis');

const UNUSABLE = ['fail', 'noaddr', 'handshake'];

// The Node for a command without a Key: always the same master (first by id),
// so a SCAN cursor goes back to the Node that issued it.
async function keylessNode(connectionId) {
    const nodes = await fetchClusterNodes(connectionId, { quiet: true });
    const node =
        nodes.find((n) => !n.flags.some((f) => UNUSABLE.includes(f))) ??
        nodes[0];
    return { ...node, address: `${node.host}:${node.port}` };
}

const hasOption = (words, option) =>
    words.some((word) => word.toUpperCase() === option);

// RESP2 prints status and bulk replies alike, so the command tells them apart.
function isStatus(name, argv) {
    if (name === 'PING') return argv.length === 1;
    if (name === 'SET') return !hasOption(argv.slice(3), 'GET');
    return ['TYPE', 'RENAME', 'MSET', 'SETEX', 'LSET'].includes(name);
}

// redis-cli prints INFO and CLIENT LIST replies, errors too, as plain text even
// with --json. These replies start as below; other text is an error.
const PLAIN_TEXT = { INFO: /^(#|$)/, 'CLIENT LIST': /^(id=|$)/ };

function parseOutput(name, out) {
    if (out.startsWith('error:')) {
        throw new Error(JSON.parse(out.slice(6)));
    }
    const plain = PLAIN_TEXT[name];
    if (plain && !out.startsWith('"')) {
        if (!plain.test(out)) throw new Error(out.trim());
        return out;
    }
    if (!out.trim()) throw new Error('No reply from redis-cli');
    return JSON.parse(out);
}

const pairs = (flat) =>
    Array.from({ length: flat.length / 2 }, (_, i) =>
        flat.slice(i * 2, i * 2 + 2)
    );

function kindOf(name, argv, reply) {
    if (reply === null) return 'nil';
    if (Array.isArray(reply)) return 'array';
    if (typeof reply === 'number') return 'integer';
    return isStatus(name, argv) ? 'status' : 'bulk';
}

// node: from keylessNode, or null to start on the Connection's seed and follow
// the redirect. -> { kind, reply }; throws the Redis or redis-cli error.
async function sendToCluster(connectionId, name, argv, node) {
    const out = await execArgvRedirected(argv, connectionId, node);
    let reply = parseOutput(name, out);
    // the standalone client (RESP3) nests each [member, score]
    if (name === 'ZRANGE' && hasOption(argv.slice(4), 'WITHSCORES')) {
        reply = pairs(reply);
    }
    return { kind: kindOf(name, argv, reply), reply };
}

module.exports = { keylessNode, sendToCluster };
