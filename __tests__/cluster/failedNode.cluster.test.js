// Opt-in cluster suite (setup and env vars: __tests__/helpers/clusterTarget.js).
// Stops one Node's Docker container (found by its published port) and always
// restarts it, waiting for cluster_state:ok, before the suite ends.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const { execFileSync } = require('child_process');
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const keyStore = require('../../services/keyStore');
const { scanClusterNodes, getClusterNodes } = require('../../services/redis');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const {
    enabled,
    SEED,
    cli,
    clusterNodes
} = require('../helpers/clusterTarget');

const CONN = 'test-cluster-failed-node';
const PREFIX = 'test:failnode:';
const KEYS = Array.from({ length: 60 }, (_, i) => `${PREFIX}${i}`);

const docker = (...argv) =>
    execFileSync('docker', argv, { encoding: 'utf8' }).trim();

async function waitFor(check, ms = 30000) {
    const until = Date.now() + ms;
    while (!check()) {
        if (Date.now() > until) {
            throw new Error('timed out waiting for the cluster');
        }
        await new Promise((r) => setTimeout(r, 250));
    }
}

// Every Node must agree, or Keys routed to a just-restarted one get CLUSTERDOWN.
const clusterOk = () => {
    try {
        return clusterNodes().every((n) =>
            cli(n.reachable, 'CLUSTER', 'INFO').includes('cluster_state:ok')
        );
    } catch {
        return false;
    }
};

(enabled ? describe : describe.skip)('cluster: a failed Node', () => {
    const app = createApp();
    let spawns;
    let victim; // { id, announced, reachable, container }
    let healthy;
    let victimKeys;
    let stopped = false;

    const stop = async () => {
        docker('stop', '-t', '1', victim.container);
        stopped = true;
    };
    const start = async () => {
        docker('start', victim.container);
        stopped = false;
        await waitFor(clusterOk);
    };

    beforeAll(async () => {
        const nodes = clusterNodes();
        const seedNode = nodes.find((n) => n.reachable === SEED);
        victim = nodes.find((n) => n !== seedNode);
        healthy = nodes.filter((n) => n !== victim);
        victim.container = docker(
            'ps',
            '--filter',
            `publish=${victim.reachable.split(':')[1]}`,
            '--format',
            '{{.Names}}'
        );
        // Page meta must still read Keys on healthy Nodes once the cluster
        // notices the stopped one; restored in afterAll.
        for (const n of healthy) {
            cli(
                n.reachable,
                'CONFIG',
                'SET',
                'cluster-allow-reads-when-down',
                'yes'
            );
        }
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 997)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({
            remap: Object.fromEntries(
                nodes.map((n) => [n.announced, n.reachable])
            )
        });
        for (const key of KEYS) {
            await keyStore.writeKey(CONN, key, 'string', 'v', 0);
        }
        victimKeys = cli(victim.reachable, '--scan', '--pattern', `${PREFIX}*`)
            .split('\n')
            .filter(Boolean);
    }, 60000);

    afterAll(async () => {
        if (stopped) {
            await start();
        }
        for (const n of healthy) {
            cli(
                n.reachable,
                'CONFIG',
                'SET',
                'cluster-allow-reads-when-down',
                'no'
            );
        }
        for (const key of KEYS) {
            await keyStore.deleteKey(CONN, key);
        }
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        expect(clusterOk()).toBe(true);
    }, 60000);

    test('search returns healthy Nodes’ Keys and names the failed Node', async () => {
        expect(victimKeys.length).toBeGreaterThan(0);
        await stop();
        try {
            // Healthy Nodes may need several continues to finish.
            const found = [];
            let cursors = ['0'];
            for (let i = 0; i < 20; i++) {
                const { body } = await request(app)
                    .get('/api/keys')
                    .query({
                        env: CONN,
                        pattern: `${PREFIX}*`,
                        count: 100,
                        cursors: JSON.stringify(cursors)
                    })
                    .expect(200);
                expect(body.failedNodes).toEqual([
                    {
                        id: victim.id,
                        address: victim.announced,
                        error: expect.any(String)
                    }
                ]);
                expect(body.hasMore).toBe(true);
                found.push(...body.keys);
                cursors = body.cursors;
                if (cursors.filter((c) => c !== 'done').length === 1) break;
            }
            expect([...found].sort()).toEqual(
                KEYS.filter((k) => !victimKeys.includes(k)).sort()
            );
        } finally {
            await start();
        }
    }, 60000);

    test('a failed Node keeps its cursor and resumes once it returns', async () => {
        const order = (await getClusterNodes(CONN)).map((n) => n.id);
        const v = order.indexOf(victim.id);
        const seen = [];
        const hop = async (cursors) => {
            const r = await scanClusterNodes(`${PREFIX}*`, cursors, 10, CONN);
            seen.push(...r.keys);
            return r;
        };

        const first = await hop(['0']);
        expect(first.cursors[v]).not.toBe('0');

        await stop();
        let second;
        try {
            second = await hop(first.cursors);
        } finally {
            await start();
        }
        expect(second.failedNodes).toEqual([
            {
                id: victim.id,
                address: victim.announced,
                error: expect.any(String)
            }
        ]);
        expect(second.cursors[v]).toBe(first.cursors[v]);
        expect(second.hasMore).toBe(true);

        let next = second;
        while (next.hasMore) {
            next = await hop(next.cursors);
            expect(next.failedNodes).toEqual([]);
        }
        // Every Key exactly once: nothing lost, finished Nodes not rescanned.
        expect([...seen].sort()).toEqual([...KEYS].sort());
    }, 120000);
});
