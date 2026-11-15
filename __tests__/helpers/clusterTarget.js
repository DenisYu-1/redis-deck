// Target for the opt-in cluster suite (see __tests__/cluster/). Skipped unless
// REDIS_TEST_CLUSTER is set. Value: seed `host:port`, or `true` for the local
// cluster on 127.0.0.1:5379. Nodes that announce addresses the host cannot
// reach (Docker-internal names) are remapped onto REDIS_TEST_CLUSTER_NODES
// (comma-separated reachable host:port, matched by CLUSTER MYID).
const { execFileSync } = require('child_process');

const FLAG = process.env.REDIS_TEST_CLUSTER;
const enabled = Boolean(FLAG) && FLAG !== 'false';
const SEED = !enabled || FLAG === 'true' ? '127.0.0.1:5379' : FLAG;
const REACHABLE = (
    process.env.REDIS_TEST_CLUSTER_NODES ||
    '127.0.0.1:5379,127.0.0.1:53791,127.0.0.1:53792'
).split(',');

const cli = (addr, ...argv) => {
    const [host, port] = addr.split(':');
    return execFileSync('redis-cli', ['-h', host, '-p', port, ...argv], {
        encoding: 'utf8'
    }).trim();
};

// announced address -> reachable address, for Nodes the host cannot reach.
function nodeRemap() {
    const byId = {};
    for (const addr of REACHABLE) {
        try {
            byId[cli(addr, 'CLUSTER', 'MYID')] = addr;
        } catch {
            // not part of this setup
        }
    }
    const remap = {};
    for (const line of cli(SEED, 'CLUSTER', 'NODES').split('\n')) {
        const [id, address] = line.split(' ');
        const announced = address.split('@')[0];
        if (byId[id] && byId[id] !== announced) {
            remap[announced] = byId[id];
        }
    }
    return remap;
}

module.exports = { enabled, SEED, nodeRemap };
