// Topology cache (SPEC R3): the Node list of a clustered Connection is
// resolved at most once per 30 s, and re-resolved after connection-refused or
// MOVED errors and after the Connection is edited or deleted.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const redis = require('../../services/redis');
const keyStore = require('../../services/keyStore');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { enabled, SEED, nodeRemap } = require('../helpers/clusterTarget');

const CONN = 'test-cluster-topology';
const PATTERN = 'test:topology:*';
const [HOST, PORT] = SEED.split(':');

const insertConnection = () => {
    db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    db.prepare(
        'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 997)'
    ).run(CONN, HOST, parseInt(PORT));
};

(enabled ? describe : describe.skip)('cluster: topology cache', () => {
    const app = createApp();
    let spawns;
    const topologyLookups = () =>
        spawns.spawns.filter(
            (args) => args.includes('CLUSTER') && args.includes('NODES')
        ).length;
    const search = () => redis.scanClusterNodes(PATTERN, ['0'], 100, CONN);
    const editConnection = () =>
        request(app)
            .put(`/api/connections/${CONN}`)
            .send({ host: HOST, port: PORT, cluster: true })
            .expect(200);

    beforeAll(() => {
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
    });

    beforeEach(async () => {
        insertConnection();
        // Start every test with no cached topology.
        await editConnection();
        spawns.reset();
    });

    afterEach(() => {
        if (Date.now.mockRestore) {
            Date.now.mockRestore();
        }
    });

    afterAll(() => {
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    });

    test('repeated searches resolve the topology once', async () => {
        await search();
        await search();
        await search();
        expect(topologyLookups()).toBe(1);
    });

    test('the topology is resolved again after 30 s', async () => {
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
        await search();
        clock.mockReturnValue(now + 29_000);
        await search();
        expect(topologyLookups()).toBe(1);
        clock.mockReturnValue(now + 31_000);
        await search();
        expect(topologyLookups()).toBe(2);
    });

    test('a MOVED error drops the cached topology', async () => {
        await search();
        // Some of these Keys live on another Node than the seed, so the seed
        // answers MOVED and keyStore follows the redirect.
        for (let i = 0; i < 10; i++) {
            await keyStore.run(CONN, ['TYPE', `test:topology:${i}`]);
        }
        await search();
        expect(topologyLookups()).toBe(2);
    });

    test('a connection-refused error drops the cached topology', async () => {
        await search();
        // Nothing listens there. redis-cli words the refusal per platform
        // ("Connection refused" on Linux, "setsockopt..." on macOS).
        await expect(
            redis.execArgv(['PING'], CONN, { host: '127.0.0.1', port: 59999 })
        ).rejects.toMatchObject({
            message: expect.stringMatching(/Could not connect|refused/)
        });
        await search();
        expect(topologyLookups()).toBe(2);
    });

    test('editing the Connection drops the cached topology', async () => {
        await search();
        await editConnection();
        await search();
        expect(topologyLookups()).toBe(2);
    });

    test('deleting the Connection drops the cached topology', async () => {
        await search();
        await request(app).delete(`/api/connections/${CONN}`).expect(200);
        insertConnection();
        await search();
        expect(topologyLookups()).toBe(2);
    });
});
