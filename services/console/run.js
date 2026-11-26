// Runs Console statements (ADR 0006): on a standalone Connection through its
// persistent client, on a clustered one through redis-cli (./cluster.js).
// Nothing here logs: Console commands are never recorded.
const { RESP_TYPES } = require('redis');
const { tokenize, isClusterMode } = require('../redis');
const { getClient } = require('../redisClient');
const { safeMessage } = require('../mcp/errors');
const { lookupCommand, refusalMessage } = require('./commands');
const { keylessNode, sendToCluster } = require('./cluster');

// Without a mapping node-redis returns status and bulk replies both as strings.
// The client speaks RESP3: maps become flat arrays again (an object would lose
// fields such as __proto__), and doubles stay text (JSON has no "inf").
const REPLY_OPTIONS = {
    typeMapping: {
        [RESP_TYPES.SIMPLE_STRING]: Buffer,
        [RESP_TYPES.MAP]: Array,
        [RESP_TYPES.DOUBLE]: String
    }
};

function kindOf(reply) {
    if (reply === null) return 'nil';
    if (Buffer.isBuffer(reply)) return 'status';
    if (Array.isArray(reply)) return 'array';
    return typeof reply === 'number' ? 'integer' : 'bulk';
}

// Status replies, also nested ones, as plain strings.
function plain(reply) {
    if (Buffer.isBuffer(reply)) return reply.toString('utf8');
    return Array.isArray(reply) ? reply.map(plain) : reply;
}

// While a lost connection is being retried, the client queues commands. Refuse
// instead, so a request never hangs and nothing runs later on its own.
async function readyClient(connectionId) {
    const client = await getClient(connectionId);
    if (!client.isReady) {
        throw new Error('Connection lost, try again');
    }
    return client;
}

const failure = (reply) => ({ kind: 'error', reply });

async function sendToServer(connectionId, argv) {
    const client = await readyClient(connectionId);
    const reply = await client.sendCommand(argv, REPLY_OPTIONS);
    return { kind: kindOf(reply), reply: plain(reply) };
}

// -> { kind, reply, node? }; node names the cluster Node that answered a
// command without a Key.
async function runStatement(connectionId, clustered, argv) {
    const { name, entry } = lookupCommand(argv);
    if (!entry) {
        return failure(refusalMessage(name));
    }
    let named = {};
    try {
        if (!clustered) {
            return await sendToServer(connectionId, argv);
        }
        const node = entry.keyless ? await keylessNode(connectionId) : null;
        named = node ? { node: node.address } : {};
        const outcome = await sendToCluster(connectionId, name, argv, node);
        return { ...outcome, ...named };
    } catch (error) {
        // a refused "localhost" is an AggregateError with an empty message
        const message = safeMessage(error.message || error.code, connectionId);
        return { ...failure(message), ...named };
    }
}

// -> one result per statement, in order. No transaction: the first error stops
// the run, and the statements after it are returned as 'not-run'.
async function runStatements(connectionId, statements) {
    const clustered = await isClusterMode(connectionId);
    const results = [];
    let stopped = false;
    for (const { line, text } of statements) {
        if (stopped) {
            results.push({ line, text, kind: 'not-run', reply: null, ms: 0 });
            continue;
        }
        const started = performance.now();
        const outcome = await runStatement(
            connectionId,
            clustered,
            tokenize(text)
        );
        stopped = outcome.kind === 'error';
        results.push({
            line,
            text,
            ...outcome,
            ms: Math.round((performance.now() - started) * 100) / 100
        });
    }
    return results;
}

module.exports = { runStatements };
