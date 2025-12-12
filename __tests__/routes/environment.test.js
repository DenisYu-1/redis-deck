const request = require('supertest');
const { createApp } = require('../../config/app');

describe('Environment Routes', () => {
    const app = createApp();
    const testConnectionId = global.TEST_CONNECTION_ID;

    describe('GET /api/environments', () => {
        test('should return list of environments', async () => {
            const response = await request(app)
                .get('/api/environments')
                .expect(200);

            expect(response.body).toHaveProperty('environments');
            expect(Array.isArray(response.body.environments)).toBe(true);
            expect(response.body.environments.length).toBeGreaterThan(0);
        });

        test('should return environments with required fields', async () => {
            const response = await request(app)
                .get('/api/environments')
                .expect(200);

            const env = response.body.environments[0];
            expect(env).toHaveProperty('id');
            expect(env).toHaveProperty('host');
            expect(env).toHaveProperty('port');
        });

        test('should include TLS flag in environment', async () => {
            const response = await request(app)
                .get('/api/environments')
                .expect(200);

            const env = response.body.environments[0];
            expect(env).toHaveProperty('tls');
            expect(typeof env.tls).toBe('boolean');
        });
    });

    describe('GET /api/health', () => {
        test('should return health status for environment', async () => {
            const response = await request(app)
                .get('/api/health')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty(
                'environment',
                testConnectionId
            );
            expect(response.body).toHaveProperty('host');
            expect(response.body).toHaveProperty('port');
        });

        test('should return TLS status in health check', async () => {
            const response = await request(app)
                .get('/api/health')
                .query({ env: testConnectionId })
                .expect(200);

            expect(response.body).toHaveProperty('tls');
            expect(typeof response.body.tls).toBe('boolean');
        });

        test('should return 404 for non-existent environment', async () => {
            const response = await request(app)
                .get('/api/health')
                .query({ env: 'non-existent-env' })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 404 when environment is not specified', async () => {
            const response = await request(app).get('/api/health').expect(404);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('not found');
        });
    });
});
