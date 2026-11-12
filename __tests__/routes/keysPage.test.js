const request = require('supertest');
const { createApp } = require('../../config/app');
const { execRedisCommand } = require('../../services/redis');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

describe('GET /api/keys page metadata, type and TTL filters', () => {
    const app = createApp();
    const env = global.TEST_CONNECTION_ID;
    const get = (query, status = 200) =>
        request(app)
            .get('/api/keys')
            .query({ env, pattern: 'test:page:*', ...query })
            .expect(status);

    beforeEach(async () => {
        await deleteTestKeys('test:page:*', env);
        await createTestKey('test:page:str', 'hello', env);
        await createTestKey('test:page:ttl', 'x', env, 30);
        await createTestKey('test:page:long', 'x', env, 7200);
        await execRedisCommand('HSET "test:page:h" f v', env);
    });
    afterEach(() => deleteTestKeys('test:page:*', env));

    test('returns type, ttl and size per key plus real scan stats', async () => {
        const { body } = await get();
        expect(body.meta['test:page:str']).toEqual({
            type: 'string',
            ttl: -1,
            size: expect.any(Number)
        });
        expect(body.meta['test:page:str'].size).toBeGreaterThan(0);
        expect(body.meta['test:page:h'].type).toBe('hash');
        expect(body.meta['test:page:ttl'].ttl).toBeGreaterThan(0);
        expect(body.scan.iterations).toBeGreaterThanOrEqual(1);
        expect(body.scan.matched).toBe(body.keys.length);
        expect(body.scan.ms).toBeGreaterThanOrEqual(0);
    });

    test('type filter uses SCAN TYPE', async () => {
        const { body } = await get({ type: 'hash' });
        expect(body.keys).toEqual(['test:page:h']);
    });

    test.each([
        ['has', ['test:page:ttl', 'test:page:long']],
        ['none', ['test:page:str', 'test:page:h']],
        ['lt1h', ['test:page:ttl']]
    ])('ttl filter %s', async (ttl, expected) => {
        const { body } = await get({ ttl });
        expect([...body.keys].sort()).toEqual([...expected].sort());
    });

    test('rejects an unknown type or ttl filter', async () => {
        await get({ type: 'bogus' }, 400);
        await get({ ttl: 'bogus' }, 400);
    });
});
