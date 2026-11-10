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

describe('POST /keys/export', () => {
    test('returns key, type, ttl and value', async () => {
        const { body } = await post('export', { keys: KEYS }).expect(200);
        const by = Object.fromEntries(body.map((e) => [e.key, e]));
        expect(by['test:bulk:a']).toEqual({
            key: 'test:bulk:a',
            type: 'string',
            ttl: -1,
            value: 'va'
        });
        expect(by['test:bulk:b'].ttl).toBeGreaterThan(0);
        expect(by['test:bulk:h']).toMatchObject({
            type: 'hash',
            value: { f: 'v' }
        });
    });

    test('shapes list, set, zset and stream like GET /keys/:key', async () => {
        await execRedisCommand('RPUSH "test:bulk:l" a b', env);
        await execRedisCommand('SADD "test:bulk:s" m', env);
        await execRedisCommand('ZADD "test:bulk:z" 1.5 m', env);
        await execRedisCommand('XADD "test:bulk:x" 1-1 f v', env);
        const keys = ['l', 's', 'z', 'x'].map((c) => `test:bulk:${c}`);
        const { body } = await post('export', { keys }).expect(200);
        const by = Object.fromEntries(body.map((e) => [e.key, e.value]));
        expect(by['test:bulk:l']).toEqual(['a', 'b']);
        expect(by['test:bulk:s']).toEqual(['m']);
        expect(by['test:bulk:z']).toEqual([{ member: 'm', score: 1.5 }]);
        expect(by['test:bulk:x']).toEqual([{ id: '1-1', fields: { f: 'v' } }]);
    });

    test('skips keys that no longer exist', async () => {
        const { body } = await post('export', {
            keys: ['test:bulk:a', 'test:bulk:nope']
        }).expect(200);
        expect(body.map((e) => e.key)).toEqual(['test:bulk:a']);
    });

    test('1000 keys ok, 1001 -> 400', async () => {
        const mk = (n) =>
            Array.from({ length: n }, (_, i) => `test:bulk:x${i}`);
        await post('export', { keys: mk(1000) }).expect(200);
        const res = await post('export', { keys: mk(1001) }).expect(400);
        expect(res.body.error).toMatch(/1000/);
    });

    test('is a read: allowed on read-only and confirm connections', async () => {
        await post('export', { keys: [] }, RO).expect(200);
        await post('export', { keys: [] }, CW).expect(200);
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
