// Tier load budgets (SPEC R8) on a clustered Connection: every Node's SCAN
// gets the Tier's COUNT cap, and continuation hops pause.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const { db } = require('../../services/database');
const { scanClusterNodes } = require('../../services/redis');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { enabled, SEED, nodeRemap } = require('../helpers/clusterTarget');

const CONN = 'test-cluster-scan-budget';

const scanCounts = (spawns) =>
    spawns.spawns
        .filter((args) => args.includes('SCAN'))
        .map((args) => args[args.indexOf('COUNT') + 1]);

(enabled ? describe : describe.skip)('cluster: Tier load budgets', () => {
    let spawns;
    const setTier = (tier) =>
        db
            .prepare('UPDATE connections SET tier = ? WHERE id = ?')
            .run(tier, CONN);

    beforeAll(() => {
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 996)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
    });

    afterAll(() => {
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    });

    beforeEach(() => spawns.reset());

    test('production caps every Node SCAN at COUNT 5,000', async () => {
        setTier('production');
        await scanClusterNodes('test:budget:*', ['0'], 20000, CONN);
        const counts = scanCounts(spawns);
        expect(counts.length).toBeGreaterThan(1);
        expect(counts.every((c) => c === '5000')).toBe(true);
    });

    test('production pauses before continuation hops', async () => {
        setTier('production');
        // A non-zero cursor on every Node: each hop continues a scan.
        const started = Date.now();
        await scanClusterNodes('test:budget:*', Array(16).fill('1'), 1, CONN);
        expect(Date.now() - started).toBeGreaterThanOrEqual(19);
    });

    test('local leaves COUNT unchanged', async () => {
        setTier('local');
        await scanClusterNodes('test:budget:*', ['0'], 20000, CONN);
        expect(scanCounts(spawns).every((c) => c === '20000')).toBe(true);
    });
});
