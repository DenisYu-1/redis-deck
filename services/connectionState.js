// Per-Connection in-memory state shared by every redis-cli call: the process
// cap (SPEC R2) and the topology cache (SPEC R3).

// Most redis-cli processes one Connection runs at once (SPEC R2).
const MAX_CLI_PER_CONNECTION = 4;
const limiters = new Map(); // connectionId -> { active, queue }

// Run spawn() under the Connection's cap. Applied once, at the spawn point,
// so it covers every caller and is never acquired twice (no deadlock). The
// entry is removed when idle, so deleted Connections leave nothing behind.
function limitCli(connectionId, spawn) {
    if (!limiters.has(connectionId)) {
        limiters.set(connectionId, { active: 0, queue: [] });
    }
    const state = limiters.get(connectionId);
    const next = () => {
        if (state.active < MAX_CLI_PER_CONNECTION && state.queue.length) {
            state.active++;
            state.queue.shift()();
        }
    };
    return new Promise((resolve, reject) => {
        state.queue.push(() =>
            // .then(spawn): a synchronous throw rejects instead of leaking a slot.
            Promise.resolve()
                .then(spawn)
                .then(resolve, reject)
                .finally(() => {
                    state.active--;
                    if (state.active === 0 && state.queue.length === 0) {
                        limiters.delete(connectionId);
                    }
                    next();
                })
        );
        next();
    });
}

// Topology cache (SPEC R3): CLUSTER NODES per Connection id, kept 30 s.
const TOPOLOGY_TTL_MS = 30000;
const topologyCache = new Map(); // connectionId -> { nodes, at }

function cachedTopology(connectionId) {
    const cached = topologyCache.get(connectionId);
    return cached && Date.now() - cached.at < TOPOLOGY_TTL_MS
        ? cached.nodes
        : null;
}

function cacheTopology(connectionId, nodes) {
    topologyCache.set(connectionId, { nodes, at: Date.now() });
}

function dropTopology(connectionId) {
    topologyCache.delete(connectionId);
}

// A MOVED reply or an unreachable Node means the cached Node list may be stale.
function dropTopologyOnError(connectionId, error) {
    const message = String((error && error.message) || '');
    if (
        error?.code === 'ECONNREFUSED' ||
        message.startsWith('Could not connect') ||
        /^MOVED /.test(message)
    ) {
        dropTopology(connectionId);
    }
}

module.exports = {
    MAX_CLI_PER_CONNECTION,
    limitCli,
    cachedTopology,
    cacheTopology,
    dropTopology,
    dropTopologyOnError
};
