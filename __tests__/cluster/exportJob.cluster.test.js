// Export job on a clustered Connection (SPEC R7, ADR 0002): values are read in
// batches per Node, and the result equals the per-Key read path.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const keyStore = require('../../services/keyStore');
const { dropTopology } = require('../../services/redis');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { enabled, SEED, clusterNodes } = require('../helpers/clusterTarget');

const CONN = 'test-cluster-export-job';
const PREFIX = 'test:expjob:';
const TYPES = ['string', 'hash', 'list', 'set', 'zset'];
const VALUES = {
    string: 'v',
    hash: { f: 'v', g: 'w' },
    list: ['a', 'b'],
    set: ['a', 'b'],
    zset: [
        { member: 'a', score: 1.5 },
        { member: 'b', score: 2 }
    ]
};
const FIXTURE = Array.from({ length: 30 }, (_, i) => ({
    key: `${PREFIX}${i}`,
    type: TYPES[i % TYPES.length]
}));
const STREAM = `${PREFIX}stream`;
const ALL = [...FIXTURE.map((f) => f.key), STREAM];

(enabled ? describe : describe.skip)('cluster: export job', () => {
    const app = createApp();
    let nodes;
    let spawns;
    let expected; // the per-Key path's answer, by Key

    async function waitDone(id) {
        for (let i = 0; i < 400; i++) {
            const { body } = await request(app)
                .get(`/api/jobs/${id}`)
                .expect(200);
            if (body.state !== 'running') return body;
            await new Promise((r) => setTimeout(r, 25));
        }
        throw new Error('job did not finish');
    }

    async function exportResult(target) {
        const { body: job } = await request(app)
            .post(`/api/jobs/export?env=${CONN}`)
            .send(target)
            .expect(202);
        expect(await waitDone(job.id)).toMatchObject({ state: 'done' });
        const { body } = await request(app)
            .get(`/api/jobs/${job.id}/result`)
            .expect(200);
        return body;
    }

    const byKey = (entries) =>
        Object.fromEntries(entries.map((e) => [e.key, e]));
    const jsonSpawns = () =>
        spawns.spawns.filter((args) => args.includes('--json')).length;

    beforeAll(async () => {
        nodes = clusterNodes();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 994)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({
            remap: Object.fromEntries(
                nodes.map((n) => [n.announced, n.reachable])
            )
        });
        for (const { key, type } of FIXTURE) {
            await keyStore.writeKey(CONN, key, type, VALUES[type], 0);
        }
        await keyStore.run(CONN, ['XADD', STREAM, '1-1', 'f', 'v']);
        expected = {};
        for (const key of ALL) {
            const { type, ttl, value } = await keyStore.readKey(CONN, key, {
                full: true
            });
            expected[key] = { key, type, ttl, value };
        }
    }, 60000);

    afterAll(async () => {
        for (const key of ALL) {
            await keyStore.deleteKey(CONN, key);
        }
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    }, 60000);

    beforeEach(() => {
        dropTopology(CONN);
        spawns.reset();
    });

    test('by pattern: equals the per-Key path, reading values in batches per Node', async () => {
        const result = await exportResult({ pattern: `${PREFIX}*` });
        expect(byKey(result)).toEqual(expected);
        // TYPE/TTL batch + value batch per Node, plus MOVED retries at most.
        expect(jsonSpawns()).toBeLessThanOrEqual(2 * nodes.length);
    }, 30000);

    test('by selection: equals the per-Key path, missing Keys skipped', async () => {
        const result = await exportResult({
            keys: [...ALL, `${PREFIX}missing`]
        });
        expect(byKey(result)).toEqual(expected);
        expect(jsonSpawns()).toBeLessThanOrEqual(2 * (nodes.length + 1));
    }, 30000);
});
