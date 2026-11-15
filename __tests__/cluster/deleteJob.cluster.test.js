// Bulk delete job on a clustered Connection (SPEC R7, ticket 09).
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const keyStore = require('../../services/keyStore');
const { dropTopology } = require('../../services/redis');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const {
    enabled,
    SEED,
    cli,
    clusterNodes
} = require('../helpers/clusterTarget');

const CONN = 'test-cluster-delete-job';
const PREFIX = 'test:deljob:';
const KEYS = Array.from({ length: 60 }, (_, i) => `${PREFIX}${i}`);

(enabled ? describe : describe.skip)('cluster: bulk delete job', () => {
    const app = createApp();
    let nodes;
    let spawns;

    const startSpawns = (remap) => {
        spawns?.restore();
        spawns = countRedisCliSpawns({ remap });
    };
    const reachable = () =>
        Object.fromEntries(nodes.map((n) => [n.announced, n.reachable]));

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

    const remaining = () =>
        nodes.flatMap((n) =>
            cli(n.reachable, '--scan', '--pattern', `${PREFIX}*`)
                .split('\n')
                .filter(Boolean)
        );

    beforeAll(() => {
        nodes = clusterNodes();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 995)'
        ).run(CONN, host, parseInt(port));
    });

    beforeEach(async () => {
        dropTopology(CONN);
        startSpawns(reachable());
        for (const key of KEYS) {
            await keyStore.writeKey(CONN, key, 'string', 'v', 0);
        }
        spawns.reset();
    }, 30000);

    afterEach(async () => {
        startSpawns(reachable());
        for (const key of remaining()) {
            await keyStore.deleteKey(CONN, key);
        }
    }, 30000);

    afterAll(() => {
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    });

    test('deletes on primaries, one redis-cli session per Node per page', async () => {
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${CONN}`)
            .send({ pattern: `${PREFIX}*` })
            .expect(202);
        const done = await waitDone(job.id);

        expect(done).toMatchObject({
            state: 'done',
            progress: { scanned: 60, deleted: 60 }
        });
        expect(remaining()).toEqual([]);

        // Delete sessions (stdin, --json) only target primaries, once each.
        const targets = spawns.spawns
            .filter((args) => args.includes('--json'))
            .map((args) => {
                const h = args.indexOf('-h');
                return `${args[h + 1]}:${args[args.indexOf('-p') + 1]}`;
            });
        const primaries = nodes.map((n) => n.announced);
        expect(targets.length).toBeGreaterThan(0);
        expect(targets.length).toBeLessThanOrEqual(primaries.length);
        expect(targets.every((t) => primaries.includes(t))).toBe(true);
    }, 30000);

    test('a selection is deleted in batches per Node, not Key by Key', async () => {
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${CONN}`)
            .send({ keys: [...KEYS, `${PREFIX}missing`] })
            .expect(202);
        const done = await waitDone(job.id);

        expect(done).toMatchObject({
            state: 'done',
            progress: { scanned: 61, deleted: 60, failed: 0 }
        });
        expect(remaining()).toEqual([]);
        // One batch on the seed, then one per owner its MOVED replies name.
        const sessions = spawns.spawns.filter((a) => a.includes('--json'));
        expect(sessions.length).toBeLessThanOrEqual(nodes.length);
    }, 30000);

    test('an unreachable Node fails the job instead of looping', async () => {
        const victim = nodes.find((n) => n.reachable !== SEED);
        startSpawns({ ...reachable(), [victim.announced]: '127.0.0.1:1' });

        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${CONN}`)
            .send({ pattern: `${PREFIX}*` })
            .expect(202);
        const done = await waitDone(job.id);

        expect(done.state).toBe('failed');
        expect(done.failedNodes).toEqual([
            expect.objectContaining({ id: victim.id })
        ]);
        expect(done.error).toMatch(victim.announced);
    }, 30000);
});
