/** @jest-environment node */
const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    db,
    createConnection,
    deleteConnection
} = require('../../services/database');

const mk = (id, extra) =>
    createConnection({ id, host: '127.0.0.1', port: 1, ...extra });
const IDS = ['test-acc-local', 'test-acc-prod', 'test-acc-ro', 'test-acc-stg'];
const flags = ({ keys, values, write, workflows, ask }) => ({
    keys,
    values,
    write,
    workflows,
    ask
});

describe('AI access routes', () => {
    const app = createApp();
    const find = async (id) =>
        (await request(app).get('/api/ai-access')).body.connections.find(
            (c) => c.id === id
        );

    beforeEach(() => {
        mk('test-acc-local', { tier: 'local' });
        mk('test-acc-stg', { tier: 'staging' });
        mk('test-acc-prod', { tier: 'production' });
        mk('test-acc-ro', { tier: 'local', readOnly: true });
    });
    afterEach(() => IDS.forEach(deleteConnection));

    it('gives every Connection its Tier defaults', async () => {
        expect(flags(await find('test-acc-local'))).toEqual({
            keys: true,
            values: true,
            write: true,
            workflows: true,
            ask: false
        });
        expect(flags(await find('test-acc-stg'))).toEqual({
            keys: true,
            values: true,
            write: false,
            workflows: false,
            ask: true
        });
        expect(flags(await find('test-acc-prod'))).toEqual({
            keys: true,
            values: false,
            write: false,
            workflows: false,
            ask: true
        });
        const ro = await find('test-acc-ro');
        expect([ro.write, ro.workflows]).toEqual([false, false]);
        expect(ro.tier).toBe('local');
        expect(ro.readOnly).toBe(true);
    });

    it('saves a change and returns the row', async () => {
        const res = await request(app)
            .put('/api/ai-access/test-acc-stg')
            .send({ values: false });
        expect(res.status).toBe(200);
        expect(res.body.values).toBe(false);
        expect((await find('test-acc-stg')).values).toBe(false);
    });

    it('turning keys off turns values, write and Workflows off', async () => {
        const res = await request(app)
            .put('/api/ai-access/test-acc-local')
            .send({ keys: false });
        expect(res.body).toMatchObject({
            keys: false,
            values: false,
            write: false,
            workflows: false
        });
    });

    it('refuses values / write / Workflows on while keys is off', async () => {
        await request(app)
            .put('/api/ai-access/test-acc-stg')
            .send({ keys: false });
        const res = await request(app)
            .put('/api/ai-access/test-acc-stg')
            .send({ write: true });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/keys/);
        expect((await find('test-acc-stg')).write).toBe(false);
    });

    it('refuses write on a Read-only Connection', async () => {
        const res = await request(app)
            .put('/api/ai-access/test-acc-ro')
            .send({ write: true });
        expect(res.status).toBe(400);
    });

    it('keeps ask on for production, whatever is sent', async () => {
        const res = await request(app)
            .put('/api/ai-access/test-acc-prod')
            .send({ ask: false });
        expect(res.body.ask).toBe(true);
    });

    it('rejects unknown Connections and non-boolean fields', async () => {
        const unknown = await request(app)
            .put('/api/ai-access/nope')
            .send({ keys: false });
        expect(unknown.status).toBe(404);
        const bad = await request(app)
            .put('/api/ai-access/test-acc-stg')
            .send({ keys: 'no' });
        expect(bad.status).toBe(400);
    });

    it('removes the row with the Connection', () => {
        const count = () =>
            db
                .prepare(
                    "SELECT COUNT(*) AS n FROM ai_access WHERE connection_id = 'test-acc-stg'"
                )
                .get().n;
        expect(count()).toBe(1);
        deleteConnection('test-acc-stg');
        expect(count()).toBe(0);
    });
});
