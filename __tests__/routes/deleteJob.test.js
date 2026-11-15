// Bulk delete as an in-memory server job (SPEC R7, ticket 09).
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

const app = createApp();
const env = global.TEST_CONNECTION_ID;
const RO = 'test-deljob-ro';
const CW = 'test-deljob-cw';

beforeAll(() => {
    for (const [id, ro, cw] of [
        [RO, 1, 0],
        [CW, 0, 1]
    ]) {
        db.prepare(
            `INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
             VALUES (?, ?, ?, '', '', 0, 0, 997, 'local', ?, ?)`
        ).run(
            id,
            process.env.REDIS_TEST_HOST || '127.0.0.1',
            parseInt(process.env.REDIS_TEST_PORT || '6379'),
            ro,
            cw
        );
    }
});
afterAll(() => {
    db.prepare('DELETE FROM connections WHERE id IN (?, ?)').run(RO, CW);
});
afterEach(() => deleteTestKeys('test:deljob:*', env));

const exists = async (k) =>
    parseInt(await execRedisCommand(`EXISTS "${k}"`, env));

async function waitDone(id) {
    for (let i = 0; i < 200; i++) {
        const { body } = await request(app).get(`/api/jobs/${id}`).expect(200);
        if (body.state !== 'running') return body;
        await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('job did not finish');
}

describe('delete job by pattern', () => {
    test('deletes every matching Key and reports progress', async () => {
        for (let i = 0; i < 30; i++) {
            await createTestKey(`test:deljob:k${i}`, 'v', env);
        }
        await createTestKey('test:deljob-keep', 'v', env);

        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ pattern: 'test:deljob:*' })
            .expect(202);
        expect(job).toMatchObject({
            id: expect.any(String),
            kind: 'delete',
            env,
            state: 'running'
        });

        const done = await waitDone(job.id);
        expect(done.state).toBe('done');
        expect(done.progress.deleted).toBe(30);
        expect(await exists('test:deljob:k0')).toBe(0);
        expect(await exists('test:deljob-keep')).toBe(1);
        await execRedisCommand('DEL test:deljob-keep', env);
    });

    test('Keys with spaces and quotes are deleted', async () => {
        await execRedisCommand('SET "test:deljob:a b" v', env);
        await execRedisCommand('SET "test:deljob:q\\"x" v', env);
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ pattern: 'test:deljob:*' })
            .expect(202);
        const done = await waitDone(job.id);
        expect(done.progress.deleted).toBe(2);
    });

    test('a selection of Keys is deleted', async () => {
        await createTestKey('test:deljob:s1', 'v', env);
        await createTestKey('test:deljob:s2', 'v', env);
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ keys: ['test:deljob:s1', 'test:deljob:missing'] })
            .expect(202);
        const done = await waitDone(job.id);
        expect(done).toMatchObject({ state: 'done', progress: { deleted: 1 } });
        expect(await exists('test:deljob:s2')).toBe(1);
    });

    test('needs a pattern or keys', async () => {
        await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({})
            .expect(400);
    });

    test('unknown job is 404', async () => {
        await request(app).get('/api/jobs/nope').expect(404);
    });
});

describe('cancel', () => {
    test('stops further deletions and reports what was already deleted', async () => {
        const keys = Array.from(
            { length: 3000 },
            (_, i) => `test:deljob:c${i}`
        );
        await execRedisCommand(
            `MSET ${keys.map((k) => `${k} v`).join(' ')}`,
            env
        );
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ keys })
            .expect(202);
        await request(app).post(`/api/jobs/${job.id}/cancel`).expect(200);

        const done = await waitDone(job.id);
        expect(done.state).toBe('cancelled');
        expect(done.progress.deleted).toBeLessThan(keys.length);
        const left = parseInt(
            await execRedisCommand(`EXISTS ${keys.join(' ')}`, env)
        );
        expect(left).toBe(keys.length - done.progress.deleted);
        await execRedisCommand(`DEL ${keys.join(' ')}`, env);
    });

    test('a finished job lists under its Connection', async () => {
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ pattern: 'test:deljob:none*' })
            .expect(202);
        await waitDone(job.id);
        const { body } = await request(app)
            .get('/api/jobs')
            .query({ env, kind: 'delete' })
            .expect(200);
        expect(body.jobs[0]).toMatchObject({ id: job.id, state: 'done' });
    });
});

describe('delete job write guard', () => {
    test('Read-only Connection refuses to create the job', async () => {
        await request(app)
            .post(`/api/jobs/delete?env=${RO}`)
            .send({ pattern: 'test:deljob:*' })
            .expect(403);
    });

    test('Confirm-writes Connection needs the confirm header', async () => {
        await request(app)
            .post(`/api/jobs/delete?env=${CW}`)
            .send({ pattern: 'test:deljob:*' })
            .expect(428);
        const { body } = await request(app)
            .post(`/api/jobs/delete?env=${CW}`)
            .set('X-Confirm-Connection', CW)
            .send({ pattern: 'test:deljob:*' })
            .expect(202);
        await waitDone(body.id);
    });
});

describe('job routes check the Connection', () => {
    test.each(['delete', 'export'])(
        '%s without env -> 400, unknown env -> 404',
        async (kind) => {
            await request(app)
                .post(`/api/jobs/${kind}`)
                .send({ pattern: 'test:deljob:*' })
                .expect(400);
            await request(app)
                .post(`/api/jobs/${kind}?env=no-such-connection`)
                .send({ pattern: 'test:deljob:*' })
                .expect(404);
        }
    );

    test('a second delete job on the same Connection -> 409 while the first runs', async () => {
        const keys = Array.from(
            { length: 3000 },
            (_, i) => `test:deljob:d${i}`
        );
        const { body: job } = await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ keys })
            .expect(202);
        await request(app)
            .post(`/api/jobs/delete?env=${env}`)
            .send({ pattern: 'test:deljob:*' })
            .expect(409);
        await request(app).post(`/api/jobs/${job.id}/cancel`).expect(200);
        await waitDone(job.id);
    });
});
