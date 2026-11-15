// Time-budgeted search (SPEC R5): a request that cannot fill the page stops
// when its time budget runs out and returns a partial result the client can
// continue from. Budget is injected so the test doesn't wait 2 s.
const request = require('supertest');
const { createApp } = require('../../config/app');
const { getClient } = require('../../services/redisClient');

const env = global.TEST_CONNECTION_ID;
const FILLER = 3000;
const RARE = ['test:tb:rare:1', 'test:tb:rare:2', 'test:tb:rare:3'];

describe('GET /api/keys time budget', () => {
    beforeAll(async () => {
        const client = await getClient(env);
        const multi = client.multi();
        for (let i = 0; i < FILLER; i++) multi.set(`test:tb:fill:${i}`, 'x');
        RARE.forEach((k) => multi.set(k, 'x'));
        await multi.exec();
    });
    // setup.js FLUSHes the worker's DB after the suite.

    const search = (app, cursors) =>
        request(app)
            .get('/api/keys')
            .query({
                env,
                pattern: 'test:tb:rare:*',
                count: 50,
                cursors: JSON.stringify(cursors)
            })
            .expect(200);

    test('an exhausted budget returns a partial page with cursor and stats', async () => {
        const { body } = await search(createApp({ searchBudgetMs: 0 }), [
            '0'
        ]);
        expect(body.hasMore).toBe(true);
        expect(body.cursors).toHaveLength(1);
        expect(body.cursors[0]).not.toBe('0');
        expect(body.scan).toEqual({
            iterations: 1,
            returned: expect.any(Number),
            matched: body.keys.length,
            ms: expect.any(Number)
        });
    });

    test('continuing a rare pattern finds every key exactly once', async () => {
        const app = createApp({ searchBudgetMs: 0 });
        const found = [];
        let cursors = ['0'];
        let requests = 0;
        let hasMore = true;
        while (hasMore) {
            const { body } = await search(app, cursors);
            found.push(...body.keys);
            cursors = body.cursors;
            hasMore = body.hasMore;
            requests++;
        }
        expect(requests).toBeGreaterThan(1);
        expect([...found].sort()).toEqual([...RARE].sort());
    });

    test('the default budget sweeps the whole keyspace in one request', async () => {
        const { body } = await search(createApp(), ['0']);
        expect(body.hasMore).toBe(false);
        expect([...body.keys].sort()).toEqual([...RARE].sort());
    });
});
