const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

const app = createApp();
const env = global.TEST_CONNECTION_ID;
const RO = 'test-bulk-ro';
const CW = 'test-bulk-cw';

beforeAll(() => {
    for (const [id, ro, cw] of [
        [RO, 1, 0],
        [CW, 0, 1]
    ]) {
        db.prepare(
            `INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
             VALUES (?, ?, ?, '', '', 0, 0, 997, 'production', ?, ?)`
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
beforeEach(async () => {
    await deleteTestKeys('test:bulk:*', env);
    await createTestKey('test:bulk:a', 'va', env);
    await createTestKey('test:bulk:b', 'vb', env, 500);
    await execRedisCommand('HSET "test:bulk:h" f v', env);
});
afterEach(() => deleteTestKeys('test:bulk:*', env));

const ttlOf = async (k) => parseInt(await execRedisCommand(`TTL ${k}`, env));
const post = (path, body, e = env) =>
    request(app).post(`/api/keys/${path}`).query({ env: e }).send(body);
const KEYS = ['test:bulk:a', 'test:bulk:b', 'test:bulk:h'];

describe('POST /keys/ttl', () => {
    test('sets a TTL on every key', async () => {
        const res = await post('ttl', { keys: KEYS, seconds: 300 }).expect(200);
        expect(res.body.updated).toBe(3);
        for (const k of KEYS) {
            const t = await ttlOf(k);
            expect(t).toBeGreaterThan(290);
            expect(t).toBeLessThanOrEqual(300);
        }
    });

    test('seconds null PERSISTs', async () => {
        await post('ttl', { keys: KEYS, seconds: null }).expect(200);
        expect(await ttlOf('test:bulk:b')).toBe(-1);
    });

    test('counts only keys that exist', async () => {
        const res = await post('ttl', {
            keys: ['test:bulk:a', 'test:bulk:nope'],
            seconds: 60
        }).expect(200);
        expect(res.body.updated).toBe(1);
    });

    test.each([
        [{ keys: [], seconds: 1 }],
        [{ keys: 'x', seconds: 1 }],
        [{ keys: KEYS, seconds: 'soon' }],
        [{ keys: KEYS, seconds: 0 }],
        [{ keys: KEYS }]
    ])('rejects bad body %j', async (body) => {
        await post('ttl', body).expect(400);
    });
});

describe('POST /keys/delete', () => {
    test('deletes exactly the selected keys', async () => {
        const res = await post('delete', {
            keys: ['test:bulk:a', 'test:bulk:h']
        }).expect(200);
        expect(res.body.deleted).toBe(2);
        expect(await execRedisCommand('EXISTS test:bulk:b', env)).toBe('1');
        expect(await execRedisCommand('EXISTS test:bulk:a', env)).toBe('0');
    });
    test('rejects empty keys', async () => {
        await post('delete', { keys: [] }).expect(400);
    });
});

describe('write guard on bulk writes', () => {
    const calls = [
        ['ttl', { keys: ['test:bulk:a'], seconds: 100 }],
        ['delete', { keys: ['test:bulk:a'] }]
    ];
    test.each(calls)('%s -> 403 on read-only', async (p, body) => {
        await post(p, body, RO).expect(403);
    });
    test.each(calls)('%s -> 428 without confirm header', async (p, body) => {
        await post(p, body, CW).expect(428);
    });
    test('confirm header lets ttl through', async () => {
        await request(app)
            .post('/api/keys/ttl')
            .query({ env: CW })
            .set('X-Confirm-Connection', CW)
            .send({ keys: ['test:bulk:none'], seconds: 100 })
            .expect(200);
    });
    test('refused write does not touch Redis', async () => {
        await post('delete', { keys: ['test:bulk:a'] }, RO);
        expect(await execRedisCommand('EXISTS test:bulk:a', env)).toBe('1');
    });
});
