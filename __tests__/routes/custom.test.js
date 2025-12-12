const request = require('supertest');
const { createApp } = require('../../config/app');
const { deleteTestKeys, keyExists } = require('../helpers/testHelpers');

describe('Custom Routes', () => {
    const app = createApp();
    const testConnectionId = global.TEST_CONNECTION_ID;

    beforeEach(async () => {
        await deleteTestKeys('test:custom:*', testConnectionId);
    });

    afterEach(async () => {
        await deleteTestKeys('test:custom:*', testConnectionId);
    });

    describe('POST /api/custom/execute', () => {
        test('should execute single command', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands: ['PING'],
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('results');
            expect(Array.isArray(response.body.results)).toBe(true);
            expect(response.body.results.length).toBe(1);
            expect(response.body.results[0]).toHaveProperty('success', true);
            expect(response.body.results[0]).toHaveProperty('result', 'PONG');
        });

        test('should execute multiple commands in sequence', async () => {
            const commands = [
                'SET "test:custom:multi1" "value1"',
                'SET "test:custom:multi2" "value2"',
                'SET "test:custom:multi3" "value3"'
            ];

            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands,
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.results.length).toBe(3);

            response.body.results.forEach((result) => {
                expect(result.success).toBe(true);
                expect(result.result).toBe('OK');
            });

            const exists1 = await keyExists(
                'test:custom:multi1',
                testConnectionId
            );
            const exists2 = await keyExists(
                'test:custom:multi2',
                testConnectionId
            );
            const exists3 = await keyExists(
                'test:custom:multi3',
                testConnectionId
            );

            expect(exists1).toBe(true);
            expect(exists2).toBe(true);
            expect(exists3).toBe(true);
        });

        test('should include command in result', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands: ['DBSIZE'],
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.results[0]).toHaveProperty(
                'command',
                'DBSIZE'
            );
        });

        test('should continue execution on command failure', async () => {
            const commands = [
                'SET "test:custom:continue" "value"',
                'INVALID_COMMAND',
                'SET "test:custom:after-error" "value"'
            ];

            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands,
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.results.length).toBe(3);
            expect(response.body.results[0].success).toBe(true);
            expect(response.body.results[1].success).toBe(false);
            expect(response.body.results[2].success).toBe(true);

            const exists = await keyExists(
                'test:custom:after-error',
                testConnectionId
            );
            expect(exists).toBe(true);
        });

        test('should handle complex command sequence', async () => {
            const commands = [
                'SET "test:custom:sequence" "initial"',
                '--raw GET "test:custom:sequence"',
                'EXPIRE "test:custom:sequence" 60',
                'TTL "test:custom:sequence"'
            ];

            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands,
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.results.length).toBe(4);
            expect(response.body.results[0].result).toBe('OK');
            expect(response.body.results[1].result.trim()).toBe('initial');
        });

        test('should return 400 when commands is not an array', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands: 'PING',
                    env: testConnectionId
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 when commands array is empty', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands: [],
                    env: testConnectionId
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 when commands is missing', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    env: testConnectionId
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle commands with special characters', async () => {
            const commands = [
                'SET "test:custom:special" "value with spaces"',
                'SET "test:custom:quotes" "value \\"with\\" quotes"'
            ];

            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands,
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            const exists1 = await keyExists(
                'test:custom:special',
                testConnectionId
            );
            expect(exists1).toBe(true);
        });

        test('should handle hash operations in sequence', async () => {
            const commands = [
                'HSET "test:custom:hash" "field1" "value1"',
                'HSET "test:custom:hash" "field2" "value2"',
                'HGETALL "test:custom:hash"'
            ];

            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands,
                    env: testConnectionId
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.results.length).toBe(3);
            expect(response.body.results[2].result).toContain('field1');
            expect(response.body.results[2].result).toContain('field2');
        });

        test('should return 400 when env is not specified', async () => {
            const response = await request(app)
                .post('/api/custom/execute')
                .send({
                    commands: ['PING']
                })
                .expect(400);

            expect(response.body.error).toBe(
                'Environment (env) parameter is required'
            );
        });
    });
});
