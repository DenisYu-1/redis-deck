const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    createTestKey,
    createTestHash,
    deleteTestKeys,
    keyExists,
    getKeyValue,
    getKeyTTL
} = require('../helpers/testHelpers');

describe('Keys Routes', () => {
    const app = createApp();
    const testConnectionId = global.TEST_CONNECTION_ID;

    beforeEach(async () => {
        await deleteTestKeys('test:keys:*', testConnectionId);
    });

    afterEach(async () => {
        await deleteTestKeys('test:keys:*', testConnectionId);
    });

    describe('GET /api/keys', () => {
        test('should return keys with pagination', async () => {
            await createTestKey('test:keys:one', 'value1', testConnectionId);
            await createTestKey('test:keys:two', 'value2', testConnectionId);

            const response = await request(app)
                .get('/api/keys')
                .query({ env: testConnectionId, pattern: 'test:keys:*' })
                .expect(200);

            expect(response.body).toHaveProperty('keys');
            expect(response.body).toHaveProperty('cursors');
            expect(response.body).toHaveProperty('hasMore');
            expect(Array.isArray(response.body.keys)).toBe(true);
            expect(response.body.keys.length).toBeGreaterThanOrEqual(2);
        });

        test('should filter keys by pattern', async () => {
            await createTestKey('test:keys:match:a', 'value', testConnectionId);
            await createTestKey('test:keys:match:b', 'value', testConnectionId);
            await createTestKey('test:keys:nomatch', 'value', testConnectionId);

            const response = await request(app)
                .get('/api/keys')
                .query({ env: testConnectionId, pattern: 'test:keys:match:*' })
                .expect(200);

            expect(response.body.keys.length).toBeGreaterThanOrEqual(2);
            response.body.keys.forEach((key) => {
                expect(key).toMatch(/test:keys:match:/);
            });
        });

        test('should handle custom count parameter', async () => {
            for (let i = 0; i < 5; i++) {
                await createTestKey(
                    `test:keys:count:${i}`,
                    'value',
                    testConnectionId
                );
            }

            const response = await request(app)
                .get('/api/keys')
                .query({
                    env: testConnectionId,
                    pattern: 'test:keys:count:*',
                    count: 10
                })
                .expect(200);

            expect(response.body.keys.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('GET /api/allkeys', () => {
        test('should return all keys matching pattern', async () => {
            await createTestKey('test:keys:all:1', 'value', testConnectionId);
            await createTestKey('test:keys:all:2', 'value', testConnectionId);
            await createTestKey('test:keys:all:3', 'value', testConnectionId);

            const response = await request(app)
                .get('/api/allkeys')
                .query({ env: testConnectionId, pattern: 'test:keys:all:*' })
                .expect(200);

            expect(response.body).toHaveProperty('keys');
            expect(response.body.keys.length).toBe(3);
        });
    });

    describe('GET /api/keys/:key', () => {
        test('should get string key value', async () => {
            await createTestKey(
                'test:keys:get',
                'test-value',
                testConnectionId
            );

            const response = await request(app)
                .get('/api/keys/test:keys:get')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('key', 'test:keys:get');
            expect(response.body).toHaveProperty('type', 'string');
            expect(response.body).toHaveProperty('value');
            expect(response.body.value.trim()).toBe('test-value');
        });

        test('should get key with TTL', async () => {
            await createTestKey('test:keys:ttl', 'value', testConnectionId, 60);

            const response = await request(app)
                .get('/api/keys/test:keys:ttl')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('ttl');
            expect(response.body.ttl).toBeGreaterThan(0);
            expect(response.body.ttl).toBeLessThanOrEqual(60);
        });

        test('should get hash key', async () => {
            await createTestHash(
                'test:keys:hash',
                {
                    field1: 'value1',
                    field2: 'value2'
                },
                testConnectionId
            );

            const response = await request(app)
                .get('/api/keys/test:keys:hash')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body.type).toBe('hash');
            expect(response.body.value).toBeDefined();
        });

        test('should return 404 for non-existent key', async () => {
            const response = await request(app)
                .get('/api/keys/test:keys:nonexistent')
                .query({ env: testConnectionId })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/keys/:key/exists', () => {
        test('should check if key exists', async () => {
            await createTestKey('test:keys:exists', 'value', testConnectionId);

            const response = await request(app)
                .get('/api/keys/test:keys:exists/exists')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toEqual({ exists: true });
        });

        test('should return false for non-existent key', async () => {
            const response = await request(app)
                .get('/api/keys/test:keys:notexists/exists')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toEqual({ exists: false });
        });
    });

    describe('POST /api/keys', () => {
        test('should create new string key', async () => {
            const response = await request(app)
                .post('/api/keys')
                .query({ env: testConnectionId })
                .send({
                    key: 'test:keys:new',
                    value: 'new-value'
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('key', 'test:keys:new');

            const exists = await keyExists('test:keys:new', testConnectionId);
            expect(exists).toBe(true);

            const value = await getKeyValue('test:keys:new', testConnectionId);
            expect(value.trim()).toBe('new-value');
        });

        test('should create key with expiry', async () => {
            const response = await request(app)
                .post('/api/keys')
                .query({ env: testConnectionId })
                .send({
                    key: 'test:keys:expiry',
                    value: 'value',
                    expiry: 60
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            const ttl = await getKeyTTL('test:keys:expiry', testConnectionId);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(60);
        });

        test('should handle JSON object values', async () => {
            const jsonValue = { name: 'test', count: 42 };

            const response = await request(app)
                .post('/api/keys')
                .query({ env: testConnectionId })
                .send({
                    key: 'test:keys:json',
                    value: jsonValue
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            const value = await getKeyValue('test:keys:json', testConnectionId);
            expect(JSON.parse(value.trim())).toEqual(jsonValue);
        });

        test('should return 400 for missing key', async () => {
            const response = await request(app)
                .post('/api/keys')
                .query({ env: testConnectionId })
                .send({ value: 'value' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 for missing value', async () => {
            const response = await request(app)
                .post('/api/keys')
                .query({ env: testConnectionId })
                .send({ key: 'test:key' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('DELETE /api/keys/:key', () => {
        test('should delete existing key', async () => {
            await createTestKey('test:keys:delete', 'value', testConnectionId);

            const response = await request(app)
                .delete('/api/keys/test:keys:delete')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('deleted', true);
            expect(response.body).toHaveProperty('key', 'test:keys:delete');

            const exists = await keyExists(
                'test:keys:delete',
                testConnectionId
            );
            expect(exists).toBe(false);
        });

        test('should handle non-existent key gracefully', async () => {
            const response = await request(app)
                .delete('/api/keys/test:keys:notexist')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body.deleted).toBe(false);
            expect(response.body.count).toBe(0);
        });
    });

    describe('DELETE /api/allkeys', () => {
        test('should delete keys by pattern', async () => {
            await createTestKey('test:keys:batch:1', 'value', testConnectionId);
            await createTestKey('test:keys:batch:2', 'value', testConnectionId);
            await createTestKey('test:keys:batch:3', 'value', testConnectionId);

            const response = await request(app)
                .delete('/api/allkeys')
                .query({ env: testConnectionId, pattern: 'test:keys:batch:*' })
                .expect(200);

            expect(response.body).toHaveProperty('count');
            expect(response.body.count).toBeGreaterThanOrEqual(3);

            const exists1 = await keyExists(
                'test:keys:batch:1',
                testConnectionId
            );
            const exists2 = await keyExists(
                'test:keys:batch:2',
                testConnectionId
            );
            const exists3 = await keyExists(
                'test:keys:batch:3',
                testConnectionId
            );

            expect(exists1).toBe(false);
            expect(exists2).toBe(false);
            expect(exists3).toBe(false);
        });

        test('should return 400 when pattern is missing', async () => {
            const response = await request(app)
                .delete('/api/allkeys')
                .query({ env: testConnectionId })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle pattern with no matches', async () => {
            const response = await request(app)
                .delete('/api/allkeys')
                .query({
                    env: testConnectionId,
                    pattern: 'test:keys:nomatch:*'
                })
                .expect(200);

            expect(response.body.count).toBe(0);
        });
    });

    describe('GET /api/keycount', () => {
        test('should return key count', async () => {
            await createTestKey('test:keys:count:1', 'value', testConnectionId);

            const response = await request(app)
                .get('/api/keycount')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('count');
            expect(typeof response.body.count).toBe('number');
            expect(response.body.count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('POST /api/keys/:key/rename', () => {
        test('should rename key', async () => {
            await createTestKey('test:keys:oldname', 'value', testConnectionId);

            const response = await request(app)
                .post('/api/keys/test:keys:oldname/rename')
                .query({ env: testConnectionId })
                .send({ newKey: 'test:keys:newname' })
                .expect(200);

            expect(response.body).toHaveProperty('oldKey', 'test:keys:oldname');
            expect(response.body).toHaveProperty('newKey', 'test:keys:newname');

            const oldExists = await keyExists(
                'test:keys:oldname',
                testConnectionId
            );
            const newExists = await keyExists(
                'test:keys:newname',
                testConnectionId
            );

            expect(oldExists).toBe(false);
            expect(newExists).toBe(true);

            await deleteTestKeys('test:keys:newname', testConnectionId);
        });

        test('should return 400 when newKey is missing', async () => {
            const response = await request(app)
                .post('/api/keys/test:keys:some/rename')
                .query({ env: testConnectionId })
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/keys/:key/expire', () => {
        test('should set expiry on key', async () => {
            await createTestKey(
                'test:keys:setexpiry',
                'value',
                testConnectionId
            );

            const response = await request(app)
                .post('/api/keys/test:keys:setexpiry/expire')
                .query({ env: testConnectionId })
                .send({ seconds: 120 })
                .expect(200);

            expect(response.body).toHaveProperty('key', 'test:keys:setexpiry');
            expect(response.body).toHaveProperty('ttl', 120);

            const ttl = await getKeyTTL(
                'test:keys:setexpiry',
                testConnectionId
            );
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(120);
        });

        test('should remove expiry with negative seconds', async () => {
            await createTestKey(
                'test:keys:persist',
                'value',
                testConnectionId,
                60
            );

            await request(app)
                .post('/api/keys/test:keys:persist/expire')
                .query({ env: testConnectionId })
                .send({ seconds: -1 })
                .expect(200);

            const ttl = await getKeyTTL('test:keys:persist', testConnectionId);
            expect(ttl).toBe(-1);
        });

        test('should return 400 when seconds is missing', async () => {
            const response = await request(app)
                .post('/api/keys/test:keys:some/expire')
                .query({ env: testConnectionId })
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/keys/:key/copy', () => {
        test('should copy string key within same environment', async () => {
            await createTestKey(
                'test:keys:source',
                'source-value',
                testConnectionId
            );

            const response = await request(app)
                .post('/api/keys/test:keys:source/copy')
                .query({ env: testConnectionId })
                .send({
                    targetKey: 'test:keys:target',
                    targetEnv: testConnectionId
                })
                .expect(200);

            expect(response.body).toHaveProperty('result');
            expect(response.body.sourceKey).toBe('test:keys:source');
            expect(response.body.targetKey).toBe('test:keys:target');

            const targetExists = await keyExists(
                'test:keys:target',
                testConnectionId
            );
            expect(targetExists).toBe(true);

            const targetValue = await getKeyValue(
                'test:keys:target',
                testConnectionId
            );
            expect(targetValue.trim()).toBe('source-value');
        });

        test('should copy key with TTL', async () => {
            await createTestKey(
                'test:keys:source-ttl',
                'value',
                testConnectionId,
                120
            );

            const response = await request(app)
                .post('/api/keys/test:keys:source-ttl/copy')
                .query({ env: testConnectionId })
                .send({
                    targetKey: 'test:keys:target-ttl',
                    targetEnv: testConnectionId
                })
                .expect(200);

            expect(response.body.result).toContain('successfully');

            const ttl = await getKeyTTL(
                'test:keys:target-ttl',
                testConnectionId
            );
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(120);
        });

        test('should return 400 when targetKey is missing', async () => {
            const response = await request(app)
                .post('/api/keys/test:keys:some/copy')
                .query({ env: testConnectionId })
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/keys/:key/zadd', () => {
        test('should add members to sorted set', async () => {
            const members = [
                { score: 1, value: 'member1' },
                { score: 2, value: 'member2' },
                { score: 3, value: 'member3' }
            ];

            const response = await request(app)
                .post('/api/keys/test:keys:zset/zadd')
                .query({ env: testConnectionId })
                .send({ members })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('key', 'test:keys:zset');
            expect(response.body.membersAdded).toBeGreaterThan(0);

            const exists = await keyExists('test:keys:zset', testConnectionId);
            expect(exists).toBe(true);
        });

        test('should add sorted set with expiry', async () => {
            const members = [{ score: 10, value: 'item1' }];

            const response = await request(app)
                .post('/api/keys/test:keys:zset-exp/zadd')
                .query({ env: testConnectionId })
                .send({ members, expiry: 60 })
                .expect(200);

            expect(response.body.success).toBe(true);

            const ttl = await getKeyTTL('test:keys:zset-exp', testConnectionId);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(60);
        });

        test('should return 400 for invalid members', async () => {
            const response = await request(app)
                .post('/api/keys/test:keys:zset-bad/zadd')
                .query({ env: testConnectionId })
                .send({ members: [] })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 for member without score', async () => {
            const response = await request(app)
                .post('/api/keys/test:keys:zset-bad2/zadd')
                .query({ env: testConnectionId })
                .send({ members: [{ value: 'test' }] })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });
});
