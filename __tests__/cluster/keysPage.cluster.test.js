// Opt-in cluster suite (setup and env vars: __tests__/helpers/cluster.js).
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const keyStore = require('../../services/keyStore');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { enabled, SEED, nodeRemap } = require('../helpers/cluster');

const CONN = 'test-cluster';
const PREFIX = 'test:perfpage:';

// 50 Keys, every type the editor writes, every third one with a TTL.
const TYPES = ['string', 'hash', 'list', 'set', 'zset'];
const VALUES = {
    string: 'v',
    hash: { f: 'v' },
    list: ['a', 'b'],
    set: ['a', 'b'],
    zset: [{ member: 'a', score: 1 }]
};
const FIXTURE = Array.from({ length: 50 }, (_, i) => ({
    key: `${PREFIX}${i}`,
    type: TYPES[i % TYPES.length],
    ttl: i % 3 === 0 ? 3600 : 0
}));

(enabled ? describe : describe.skip)('cluster: one Keys page', () => {
    const app = createApp();
    let spawns;

    beforeAll(async () => {
        const [host, port] = SEED.split(':');
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 998)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
        for (const { key, type, ttl } of FIXTURE) {
            await keyStore.writeKey(CONN, key, type, VALUES[type], ttl);
        }
    }, 60000);

    afterAll(async () => {
        for (const { key } of FIXTURE) {
            await keyStore.deleteKey(CONN, key);
        }
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    }, 60000);

    // Baseline before perf work (local 3-Node cluster, 2026-11): 192 spawns
    // per page = 8 for scanning (2 hops x (CLUSTER NODES + 3 SCAN)) + 184 for
    // Page meta (50 TYPE on the seed, 34 MOVED retries, 50 TTL, 50 MEMORY).
    // Scan hops vary with the cluster's other data, so only Page meta is
    // gated. Later tickets tighten this to <= 1 spawn per Node (SPEC R1).
    const BASELINE_PAGE_META_SPAWNS = 184;
    const isScanSpawn = (args) =>
        args.includes('--csv') || args.includes('CLUSTER');

    test(`a 50-Key page returns the same Keys, types and TTLs with <= ${BASELINE_PAGE_META_SPAWNS} Page meta spawns`, async () => {
        spawns.reset();
        const { body } = await request(app)
            .get('/api/keys')
            .query({ env: CONN, pattern: `${PREFIX}*`, count: 50 })
            .expect(200);
        const pageMetaSpawns = spawns.spawns.filter(
            (args) => !isScanSpawn(args)
        ).length;

        expect([...body.keys].sort()).toEqual(FIXTURE.map((f) => f.key).sort());
        for (const { key, type, ttl } of FIXTURE) {
            const meta = body.meta[key];
            expect(meta.type).toBe(type);
            if (ttl) {
                expect(meta.ttl).toBeGreaterThan(3500);
                expect(meta.ttl).toBeLessThanOrEqual(3600);
            } else {
                expect(meta.ttl).toBe(-1);
            }
            // Size is lazy on clusters after ticket 06; when present it is real.
            if (meta.size != null) {
                expect(meta.size).toBeGreaterThan(0);
            }
        }
        expect(pageMetaSpawns).toBeLessThanOrEqual(BASELINE_PAGE_META_SPAWNS);
    });
});
