/** @jest-environment node */
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const {
    recordActivity,
    cleanupOldActivity
} = require('../../services/aiActivity');

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function entry(overrides) {
    return {
        time: NOW,
        client: 'Claude Code',
        connectionId: 'test-a',
        operation: 'set_key',
        target: 'test:k',
        result: 'ok',
        ...overrides
    };
}

describe('AI activity routes', () => {
    const app = createApp();

    beforeEach(() => {
        db.prepare('DELETE FROM ai_activity').run();
        db.prepare('DELETE FROM settings').run();
    });

    it('lists entries newest first with the total', async () => {
        recordActivity(entry({ time: NOW - 2000, target: 'test:old' }));
        recordActivity(entry({ time: NOW, target: 'test:new' }));
        recordActivity(
            entry({
                time: NOW - 1000,
                target: 'test:mid',
                result: 'denied',
                error: 'The user denied set_key'
            })
        );

        const res = await request(app).get('/api/ai-activity').expect(200);

        expect(res.body.total).toBe(3);
        expect(res.body.entries.map((e) => e.target)).toEqual([
            'test:new',
            'test:mid',
            'test:old'
        ]);
        expect(res.body.entries[1]).toMatchObject({
            time: NOW - 1000,
            client: 'Claude Code',
            connectionId: 'test-a',
            operation: 'set_key',
            result: 'denied',
            error: 'The user denied set_key'
        });
    });

    it('filters by Connection', async () => {
        recordActivity(entry({ connectionId: 'test-a', target: 'test:a' }));
        recordActivity(entry({ connectionId: 'test-b', target: 'test:b' }));

        const res = await request(app)
            .get('/api/ai-activity?connectionId=test-b')
            .expect(200);

        expect(res.body.total).toBe(1);
        expect(res.body.entries.map((e) => e.target)).toEqual(['test:b']);
    });

    it('filters by text (tool, key, connection), status and client', async () => {
        recordActivity(entry({ operation: 'get_key', target: 'user:1' }));
        recordActivity(
            entry({ operation: 'scan', target: 'order:9', result: 'blocked' })
        );
        recordActivity(
            entry({
                client: 'Cursor',
                connectionId: 'prod-eu',
                result: 'error'
            })
        );
        const targets = async (q) =>
            (await request(app).get(`/api/ai-activity?${q}`).expect(200)).body;

        expect((await targets('q=get_key')).total).toBe(1);
        expect((await targets('q=order')).total).toBe(1);
        expect((await targets('q=prod-eu')).total).toBe(1);
        expect((await targets('status=blocked')).total).toBe(1);
        expect((await targets('client=Cursor')).total).toBe(1);
        expect((await targets('client=Cursor&status=ok')).total).toBe(0);
        expect((await targets('q=%25')).total).toBe(0);
    });

    it('rejects an unknown status', async () => {
        await request(app).get('/api/ai-activity?status=nope').expect(400);
    });

    it('lists distinct clients with their last call', async () => {
        recordActivity(entry({ client: 'Cursor', time: NOW - 5000 }));
        recordActivity(entry({ client: 'Cursor', time: NOW - 1000 }));
        recordActivity(entry({ client: 'Codex', time: NOW }));

        const res = await request(app)
            .get('/api/ai-activity/clients')
            .expect(200);

        expect(res.body.clients).toEqual([
            { client: 'Codex', lastCallAt: NOW },
            { client: 'Cursor', lastCallAt: NOW - 1000 }
        ]);
    });

    it('clear deletes every entry', async () => {
        recordActivity(entry({}));
        recordActivity(entry({}));

        await request(app)
            .delete('/api/ai-activity')
            .expect(200, { removed: 2 });

        const res = await request(app).get('/api/ai-activity').expect(200);
        expect(res.body.total).toBe(0);
    });

    it('pages with limit and offset', async () => {
        for (let i = 0; i < 5; i++) {
            recordActivity(entry({ time: NOW + i, target: `test:${i}` }));
        }

        const res = await request(app)
            .get('/api/ai-activity?limit=2&offset=1')
            .expect(200);

        expect(res.body.total).toBe(5);
        expect(res.body.entries.map((e) => e.target)).toEqual([
            'test:3',
            'test:2'
        ]);
    });

    it('rejects a bad limit', async () => {
        await request(app).get('/api/ai-activity?limit=abc').expect(400);
        await request(app).get('/api/ai-activity?limit=0').expect(400);
    });

    it('"Log AI operations" is on by default and can be turned off and on', async () => {
        const get = async () =>
            (await request(app).get('/api/ai-activity/settings').expect(200))
                .body;

        expect(await get()).toEqual({ logEnabled: true });

        await request(app)
            .put('/api/ai-activity/settings')
            .send({ logEnabled: false })
            .expect(200, { logEnabled: false });
        expect(await get()).toEqual({ logEnabled: false });

        recordActivity(entry({}));
        const list = await request(app).get('/api/ai-activity').expect(200);
        expect(list.body.total).toBe(0);

        await request(app)
            .put('/api/ai-activity/settings')
            .send({ logEnabled: true })
            .expect(200);
        expect(await get()).toEqual({ logEnabled: true });
    });

    it('rejects a non-boolean toggle', async () => {
        await request(app)
            .put('/api/ai-activity/settings')
            .send({ logEnabled: 'yes' })
            .expect(400);
    });

    it('cleanup removes entries older than 30 days and keeps newer ones', async () => {
        recordActivity(entry({ time: NOW - 31 * DAY, target: 'test:old' }));
        recordActivity(entry({ time: NOW - 29 * DAY, target: 'test:recent' }));

        expect(cleanupOldActivity(30, NOW)).toBe(1);

        const res = await request(app).get('/api/ai-activity').expect(200);
        expect(res.body.entries.map((e) => e.target)).toEqual(['test:recent']);
    });
});
