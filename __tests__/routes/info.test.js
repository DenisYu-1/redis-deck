const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    createTestKey,
    deleteTestKeys,
    keyExists
} = require('../helpers/testHelpers');

describe('Info Routes', () => {
    const app = createApp();
    const testConnectionId = global.TEST_CONNECTION_ID;

    beforeEach(async () => {
        await deleteTestKeys('test:info:*', testConnectionId);
    });

    afterEach(async () => {
        await deleteTestKeys('test:info:*', testConnectionId);
    });

    describe('GET /api/info', () => {
        test('should return Redis server info', async () => {
            const response = await request(app)
                .get('/api/info')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toBeDefined();
            expect(typeof response.body).toBe('object');
        });

        test('should return info sections', async () => {
            const response = await request(app)
                .get('/api/info')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('server');
        });

        test('should include redis version in server section', async () => {
            const response = await request(app)
                .get('/api/info')
                .query({ env: testConnectionId })
                .expect(200);

            if (response.body.server) {
                expect(response.body.server).toHaveProperty('redis_version');
            }
        });
    });

    describe('POST /api/flush', () => {
        test('should flush database with confirmation', async () => {
            await createTestKey('test:info:flush', 'value', testConnectionId);

            const response = await request(app)
                .post('/api/flush')
                .query({ env: testConnectionId })
                .send({ confirm: true })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('db', testConnectionId);

            const exists = await keyExists('test:info:flush', testConnectionId);
            expect(exists).toBe(false);
        });

        test('should return 400 without confirmation', async () => {
            const response = await request(app)
                .post('/api/flush')
                .query({ env: testConnectionId })
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 with confirm: false', async () => {
            const response = await request(app)
                .post('/api/flush')
                .query({ env: testConnectionId })
                .send({ confirm: false })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/exec', () => {
        test('should execute arbitrary Redis command', async () => {
            const response = await request(app)
                .post('/api/exec')
                .send({
                    command: 'PING',
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body).toHaveProperty('result');
            expect(response.body.result).toBe('PONG');
        });

        test('should execute SET command', async () => {
            const response = await request(app)
                .post('/api/exec')
                .send({
                    command: 'SET "test:info:exec" "exec-value"',
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.result).toBe('OK');

            const exists = await keyExists('test:info:exec', testConnectionId);
            expect(exists).toBe(true);
        });

        test('should execute GET command', async () => {
            await createTestKey(
                'test:info:execget',
                'get-value',
                testConnectionId
            );

            const response = await request(app)
                .post('/api/exec')
                .send({
                    command: '--raw GET "test:info:execget"',
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.result.trim()).toBe('get-value');
        });

        test('should return 400 when command is missing', async () => {
            const response = await request(app)
                .post('/api/exec')
                .send({ env: testConnectionId })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle invalid commands gracefully', async () => {
            const response = await request(app)
                .post('/api/exec')
                .send({
                    command: 'INVALID_COMMAND',
                    env: testConnectionId
                })
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/copy-key', () => {
        test('should copy string key between environments', async () => {
            await createTestKey(
                'test:info:copykey',
                'copy-value',
                testConnectionId
            );

            const response = await request(app)
                .post('/api/copy-key')
                .send({
                    sourceKey: 'test:info:copykey',
                    targetKey: 'test:info:copytarget',
                    sourceEnv: testConnectionId,
                    targetEnv: testConnectionId
                })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('successfully');

            const targetExists = await keyExists(
                'test:info:copytarget',
                testConnectionId
            );
            expect(targetExists).toBe(true);

            await deleteTestKeys('test:info:copytarget', testConnectionId);
        });

        test('should return 400 when required fields are missing', async () => {
            const response = await request(app)
                .post('/api/copy-key')
                .send({
                    sourceKey: 'test:key'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 404 when source key does not exist', async () => {
            const response = await request(app)
                .post('/api/copy-key')
                .send({
                    sourceKey: 'test:info:nonexistent',
                    targetKey: 'test:info:target',
                    sourceEnv: testConnectionId,
                    targetEnv: testConnectionId
                })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle keys with TTL', async () => {
            await createTestKey(
                'test:info:copykey-ttl',
                'value',
                testConnectionId,
                120
            );

            const response = await request(app)
                .post('/api/copy-key')
                .send({
                    sourceKey: 'test:info:copykey-ttl',
                    targetKey: 'test:info:copytarget-ttl',
                    sourceEnv: testConnectionId,
                    targetEnv: testConnectionId
                })
                .expect(200);

            expect(response.body.message).toContain('successfully');

            await deleteTestKeys('test:info:copytarget-ttl', testConnectionId);
        });
    });
});
