const request = require('supertest');
const { createApp } = require('../../config/app');
const { execRedisCommand } = require('../../services/redis');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

describe('GET /api/keys/:key/meta', () => {
    const app = createApp();
    const env = global.TEST_CONNECTION_ID;
    const meta = (key, status = 200) =>
        request(app)
            .get(`/api/keys/${encodeURIComponent(key)}/meta`)
            .query({ env })
            .expect(status);

    beforeEach(async () => {
        await deleteTestKeys('test:meta:*', env);
        await createTestKey('test:meta:str', 'hello', env);
        await execRedisCommand('HSET "test:meta:h" a 1 b 2', env);
        await execRedisCommand('RPUSH "test:meta:l" x y z', env);
        await execRedisCommand('SADD "test:meta:s" m1 m2 m3 m4', env);
        await execRedisCommand('ZADD "test:meta:z" 1 a 2 b', env);
        await execRedisCommand('XADD "test:meta:x" * f v', env);
    });
    afterEach(() => deleteTestKeys('test:meta:*', env));

    test('string: encoding, idle, memory and byte length', async () => {
        const { body } = await meta('test:meta:str');
        expect(body.encoding).toBe('embstr');
        expect(body.length).toBe(5);
        expect(body.memory).toBeGreaterThan(0);
        expect(body.idle).toBeGreaterThanOrEqual(0);
    });

    test.each([
        ['h', 2],
        ['l', 3],
        ['s', 4],
        ['z', 2],
        ['x', 1]
    ])('length of %s uses the type cardinality command', async (k, len) => {
        const { body } = await meta(`test:meta:${k}`);
        expect(body.length).toBe(len);
        expect(typeof body.encoding).toBe('string');
    });

    test('missing key is 404', async () => {
        await meta('test:meta:nope', 404);
    });
});
