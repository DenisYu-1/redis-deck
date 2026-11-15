// Parallel Node scans (SPEC R2): a search scans all Nodes at once, with at
// most 4 redis-cli processes running per Connection, and returns the same
// Keys and Scan cursor set shape as the sequential path.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const { db } = require('../../services/database');
const keyStore = require('../../services/keyStore');
const { scanClusterNodes, getClusterNodes } = require('../../services/redis');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { enabled, SEED, nodeRemap } = require('../helpers/clusterTarget');

const CONN = 'test-cluster-parallel-scan';
const PREFIX = 'test:parallel:';
const KEYS = Array.from({ length: 80 }, (_, i) => `${PREFIX}${i}`);
const CAP = 4;

(enabled ? describe : describe.skip)('cluster: parallel Node scans', () => {
    let spawns;
    let order; // Node ids in Scan cursor set order

    beforeAll(async () => {
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 997)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
        for (const key of KEYS) {
            await keyStore.writeKey(CONN, key, 'string', 'v', 0);
        }
        order = (await getClusterNodes(CONN)).map((n) => n.id);
    }, 60000);

    afterAll(async () => {
        for (const key of KEYS) {
            await keyStore.deleteKey(CONN, key);
        }
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    }, 60000);

    beforeEach(() => spawns.reset());

    test('one search scans every Node at the same time', async () => {
        await scanClusterNodes(`${PREFIX}*`, ['0'], 10, CONN);
        expect(order.length).toBeGreaterThan(1);
        expect(spawns.count).toBe(order.length);
        expect(spawns.peak).toBe(Math.min(order.length, CAP));
    });

    test('concurrent searches on one Connection never exceed 4 processes', async () => {
        await Promise.all(
            Array.from({ length: 4 }, () =>
                scanClusterNodes(`${PREFIX}*`, ['0'], 10, CONN)
            )
        );
        expect(spawns.count).toBe(4 * order.length);
        expect(spawns.peak).toBe(CAP);
    });

    test('Load More walks every Key once, one cursor per Node in Node order', async () => {
        const seen = [];
        let cursors = ['0'];
        let hasMore = true;
        while (hasMore) {
            const r = await scanClusterNodes(`${PREFIX}*`, cursors, 5, CONN);
            expect(r.cursors).toHaveLength(order.length);
            r.cursors.forEach((c) => expect(typeof c).toBe('string'));
            expect(r.failedNodes).toEqual([]);
            seen.push(...r.keys);
            ({ cursors, hasMore } = r);
        }
        expect(cursors.every((c) => c === 'done')).toBe(true);
        expect([...seen].sort()).toEqual([...KEYS].sort());
    }, 60000);
});
