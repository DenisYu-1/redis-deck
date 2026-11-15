// Export as an in-memory server job (SPEC R7, ticket 10).
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

const app = createApp();
const env = global.TEST_CONNECTION_ID;
const RO = 'test-expjob-ro';

beforeAll(() => {
    db.prepare(
        `INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
         VALUES (?, ?, ?, '', '', 0, 0, 997, 'local', 1, 0)`
    ).run(
        RO,
        process.env.REDIS_TEST_HOST || '127.0.0.1',
        parseInt(process.env.REDIS_TEST_PORT || '6379')
    );
});
afterAll(() => {
    db.prepare('DELETE FROM connections WHERE id = ?').run(RO);
});

async function waitDone(id) {
    for (let i = 0; i < 400; i++) {
        const { body } = await request(app).get(`/api/jobs/${id}`).expect(200);
        if (body.state !== 'running') return body;
        await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('job did not finish');
}

const start = (body, conn = env) =>
    request(app).post(`/api/jobs/export?env=${conn}`).send(body);

// Large sets are created and removed in one command each.
const big = [];
async function mset(keys) {
    await execRedisCommand(`MSET ${keys.map((k) => `${k} v`).join(' ')}`, env);
    big.push(keys);
}
afterEach(async () => {
    for (const keys of big.splice(0)) {
        await execRedisCommand(`DEL ${keys.join(' ')}`, env);
    }
    await deleteTestKeys('test:expjob:*', env);
});

describe('export job by pattern', () => {
    test('exports every matching Key; the result downloads when done', async () => {
        await createTestKey('test:expjob:a', 'va', env);
        await execRedisCommand('HSET test:expjob:h f v', env);
        await createTestKey('test:expjob-skip', 'v', env);

        const { body: job } = await start({ pattern: 'test:expjob:*' }).expect(
            202
        );
        expect(job).toMatchObject({ kind: 'export', env, state: 'running' });

        const done = await waitDone(job.id);
        expect(done).toMatchObject({
            state: 'done',
            progress: { exported: 2, truncated: false }
        });

        const res = await request(app)
            .get(`/api/jobs/${job.id}/result`)
            .expect(200);
        expect(res.headers['content-disposition']).toMatch(/attachment/);
        const by = Object.fromEntries(res.body.map((e) => [e.key, e]));
        expect(by['test:expjob:a']).toEqual({
            key: 'test:expjob:a',
            type: 'string',
            ttl: -1,
            value: 'va'
        });
        expect(by['test:expjob:h'].value).toEqual({ f: 'v' });
        expect(by['test:expjob-skip']).toBeUndefined();
        await execRedisCommand('DEL test:expjob-skip', env);
    });

    test('a large pattern stops at MAX_EXPORT and never holds more', async () => {
        const keys = Array.from(
            { length: 2500 },
            (_, i) => `test:expjob:l${i}`
        );
        await mset(keys);
        const bulkKeys = require('../../services/bulkKeys');
        const spy = jest.spyOn(bulkKeys, 'exportKeys');

        const { body: job } = await start({ pattern: 'test:expjob:*' }).expect(
            202
        );
        const done = await waitDone(job.id);
        const largest = Math.max(...spy.mock.calls.map(([, k]) => k.length));
        spy.mockRestore();

        expect(done).toMatchObject({
            state: 'done',
            progress: { exported: 1000, truncated: true }
        });
        // Values are read a small chunk at a time, not all matched Keys at once.
        expect(largest).toBeLessThanOrEqual(100);
        const res = await request(app)
            .get(`/api/jobs/${job.id}/result`)
            .expect(200);
        expect(res.body).toHaveLength(1000);
    });
});

describe('export job by selection', () => {
    test('exports the selected Keys, skipping missing ones', async () => {
        await createTestKey('test:expjob:s1', 'v', env);
        const { body: job } = await start({
            keys: ['test:expjob:s1', 'test:expjob:nope']
        }).expect(202);
        await waitDone(job.id);
        const res = await request(app)
            .get(`/api/jobs/${job.id}/result`)
            .expect(200);
        expect(res.body.map((e) => e.key)).toEqual(['test:expjob:s1']);
    });

    test('shapes list, set, zset and stream like GET /keys/:key', async () => {
        await execRedisCommand('RPUSH test:expjob:l a b', env);
        await execRedisCommand('SADD test:expjob:s m', env);
        await execRedisCommand('ZADD test:expjob:z 1.5 m', env);
        await execRedisCommand('XADD test:expjob:x 1-1 f v', env);
        await execRedisCommand('SET test:expjob:t v EX 300', env);
        const keys = ['l', 's', 'z', 'x', 't'].map((c) => `test:expjob:${c}`);
        const { body: job } = await start({ keys }).expect(202);
        await waitDone(job.id);
        const { body } = await request(app)
            .get(`/api/jobs/${job.id}/result`)
            .expect(200);
        const by = Object.fromEntries(body.map((e) => [e.key, e]));
        expect(by['test:expjob:l'].value).toEqual(['a', 'b']);
        expect(by['test:expjob:s'].value).toEqual(['m']);
        expect(by['test:expjob:z'].value).toEqual([
            { member: 'm', score: 1.5 }
        ]);
        expect(by['test:expjob:x'].value).toEqual([
            { id: '1-1', fields: { f: 'v' } }
        ]);
        expect(by['test:expjob:t'].ttl).toBeGreaterThan(0);
    });

    test('more than MAX_EXPORT selected Keys -> 400', async () => {
        const keys = Array.from(
            { length: 1001 },
            (_, i) => `test:expjob:x${i}`
        );
        const res = await start({ keys }).expect(400);
        expect(res.body.error).toMatch(/1000/);
    });

    test('needs a pattern or keys', async () => {
        await start({}).expect(400);
    });
});

describe('export job lifecycle', () => {
    test('a cancelled export has no result', async () => {
        const keys = Array.from(
            { length: 1000 },
            (_, i) => `test:expjob:c${i}`
        );
        await mset(keys);
        const { body: job } = await start({ keys }).expect(202);
        await request(app).post(`/api/jobs/${job.id}/cancel`).expect(200);
        const done = await waitDone(job.id);
        expect(done.state).toBe('cancelled');
        expect(done.progress.exported).toBeLessThan(keys.length);
        await request(app).get(`/api/jobs/${job.id}/result`).expect(409);
    });

    test('result of an unknown job is 404', async () => {
        await request(app).get('/api/jobs/nope/result').expect(404);
    });

    test('is a read: a Read-only Connection may export', async () => {
        const { body: job } = await start(
            { pattern: 'test:expjob:none*' },
            RO
        ).expect(202);
        expect((await waitDone(job.id)).state).toBe('done');
    });
});
