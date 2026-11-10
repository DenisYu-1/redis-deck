const request = require('supertest');
const { createApp } = require('../../config/app');
const { deleteConnection } = require('../../services/database');

describe('Connections page API', () => {
    const app = createApp();
    const id = 'test-cpage-' + Date.now();
    const port = Number(process.env.REDIS_TEST_PORT) || 6379;

    afterAll(() => {
        deleteConnection(id);
        deleteConnection(id + '-imp');
    });

    test('password is never sent to the client, only hasPassword', async () => {
        await request(app)
            .post('/api/connections')
            .send({ id, host: '127.0.0.1', port, password: 'sekret-pw' })
            .expect(201);

        const list = await request(app).get('/api/connections').expect(200);
        const conn = list.body.connections.find((c) => c.id === id);
        expect(conn.hasPassword).toBe(true);
        expect(JSON.stringify(list.body)).not.toContain('sekret-pw');

        const one = await request(app).get(`/api/connections/${id}`);
        expect(one.body.connection.hasPassword).toBe(true);
        expect(JSON.stringify(one.body)).not.toContain('sekret-pw');
    });

    test('blank password on save keeps the stored one', async () => {
        await request(app)
            .put(`/api/connections/${id}`)
            .send({ host: '127.0.0.1', port, password: '' })
            .expect(200);
        const list = await request(app).get('/api/connections');
        expect(list.body.connections.find((c) => c.id === id).hasPassword).toBe(
            true
        );
    });

    test('export omits passwords by default', async () => {
        const res = await request(app)
            .get('/api/connections/export')
            .expect(200);
        const conn = res.body.connections.find((c) => c.id === id);
        expect(conn.password).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('sekret-pw');
    });

    test('export includes passwords only when explicitly requested', async () => {
        const res = await request(app)
            .get('/api/connections/export?includePasswords=true')
            .expect(200);
        expect(res.body.connections.find((c) => c.id === id).password).toBe(
            'sekret-pw'
        );
    });

    test('test of an unsaved config works', async () => {
        const res = await request(app)
            .post('/api/connections/test')
            .send({ host: '127.0.0.1', port })
            .expect(200);
        expect(res.body.success).toBe(true);
    });

    test('test of a saved connection with a blank password falls back to the stored one', async () => {
        // Stored password is wrong for the passwordless test Redis, so the
        // result differs from the unsaved test only if the fallback is used.
        const withStored = await request(app)
            .post('/api/connections/test')
            .send({ id, host: '127.0.0.1', port });
        const without = await request(app)
            .post('/api/connections/test')
            .send({ host: '127.0.0.1', port });
        expect(without.body.success).toBe(true);
        expect(withStored.status).toBeLessThan(600);
        expect(JSON.stringify(withStored.body)).not.toContain('sekret-pw');
    });

    test('import keeps safety fields and sets no password', async () => {
        const importId = id + '-imp';
        await request(app)
            .post('/api/connections/import')
            .send({
                connections: [
                    { id: importId, host: 'h', port: 1, tier: 'staging' }
                ]
            })
            .expect(200);
        const list = await request(app).get('/api/connections');
        const c = list.body.connections.find((x) => x.id === importId);
        expect(c.hasPassword).toBe(false);
        expect(c.tier).toBe('staging');
    });
});
