const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    createConnection,
    deleteConnection,
    db
} = require('../../services/database');

describe('Saved search routes', () => {
    const app = createApp();
    const connA = 'test-search-a-' + Date.now();
    const connB = 'test-search-b-' + Date.now();

    beforeAll(() => {
        createConnection({
            id: connA,
            host: '127.0.0.1',
            port: 6379,
            tier: 'production',
            order: 9001
        });
        createConnection({
            id: connB,
            host: '127.0.0.1',
            port: 6379,
            order: 9002
        });
    });

    afterAll(() => {
        deleteConnection(connA);
        deleteConnection(connB);
    });

    const count = (id) =>
        db
            .prepare(
                'SELECT COUNT(*) n FROM saved_searches WHERE connection_id = ?'
            )
            .get(id).n;

    test('creates, lists and deletes a search per connection', async () => {
        const created = await request(app)
            .post(`/api/connections/${connA}/searches`)
            .send({ name: 'Sessions', pattern: 'session:*' })
            .expect(201);
        expect(created.body.search).toMatchObject({
            name: 'Sessions',
            pattern: 'session:*'
        });
        expect(typeof created.body.search.id).toBe('number');

        const list = await request(app)
            .get(`/api/connections/${connA}/searches`)
            .expect(200);
        expect(list.body.searches).toHaveLength(1);

        const other = await request(app)
            .get(`/api/connections/${connB}/searches`)
            .expect(200);
        expect(other.body.searches).toEqual([]);

        await request(app)
            .delete(
                `/api/connections/${connA}/searches/${created.body.search.id}`
            )
            .expect(200);
        const after = await request(app).get(
            `/api/connections/${connA}/searches`
        );
        expect(after.body.searches).toEqual([]);
    });

    test('rejects missing name or pattern', async () => {
        await request(app)
            .post(`/api/connections/${connA}/searches`)
            .send({ name: '', pattern: 'x' })
            .expect(400);
        await request(app)
            .post(`/api/connections/${connA}/searches`)
            .send({ name: 'x' })
            .expect(400);
    });

    test('404 for unknown connection or search', async () => {
        await request(app)
            .get('/api/connections/nope-xyz/searches')
            .expect(404);
        await request(app)
            .post('/api/connections/nope-xyz/searches')
            .send({ name: 'a', pattern: 'b' })
            .expect(404);
        await request(app)
            .delete(`/api/connections/${connA}/searches/999999`)
            .expect(404);
    });

    test('does not store a production badge or tier', async () => {
        const res = await request(app)
            .post(`/api/connections/${connA}/searches`)
            .send({ name: 'P', pattern: 'p:*', production: true, tier: 'x' })
            .expect(201);
        expect(res.body.search).not.toHaveProperty('production');
        expect(res.body.search).not.toHaveProperty('tier');
        const cols = db
            .prepare('PRAGMA table_info(saved_searches)')
            .all()
            .map((c) => c.name);
        expect(cols).not.toContain('tier');
        expect(cols).not.toContain('production');
    });

    test('deleting a connection removes its searches', async () => {
        expect(count(connA)).toBeGreaterThan(0);
        deleteConnection(connA);
        expect(count(connA)).toBe(0);
    });
});
