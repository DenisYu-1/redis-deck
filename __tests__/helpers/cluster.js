// Shared setup for the opt-in cluster suite (__tests__/cluster/, SPEC
// docs/perf-cluster-scan/SPEC.md, ADR 0002). Enabled when REDIS_TEST_CLUSTER is
// set: seed `host:port`, or `true` for the local cluster on 127.0.0.1:5379.
// Nodes that announce addresses the host cannot reach (Docker-internal names)
// are remapped onto REDIS_TEST_CLUSTER_NODES (comma-separated reachable
// host:port, matched by CLUSTER MYID; default = the local cluster's ports).
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

// Masters as { id, announced, reachable }.
function clusterNodes() {
    const byId = {};
    for (const addr of REACHABLE) {
        try {
            byId[cli(addr, 'CLUSTER', 'MYID')] = addr;
        } catch {
            // not part of this setup
        }
    }
    return cli(SEED, 'CLUSTER', 'NODES')
        .split('\n')
        .map((line) => line.split(' '))
        .filter(([, , flags]) => flags.split(',').includes('master'))
        .map(([id, address]) => {
            const announced = address.split('@')[0];
            return { id, announced, reachable: byId[id] || announced };
        });
}

// announced address -> reachable address, for Nodes the host cannot reach.
function nodeRemap() {
    return Object.fromEntries(
        clusterNodes()
            .filter((n) => n.reachable !== n.announced)
            .map((n) => [n.announced, n.reachable])
    );
}

module.exports = { enabled, SEED, cli, clusterNodes, nodeRemap };
