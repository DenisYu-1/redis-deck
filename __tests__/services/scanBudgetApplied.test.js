// Tier load budgets (SPEC R8) on a non-clustered Connection: scanClusterNodes
// (every scan loop goes through it) caps COUNT and pauses continuation hops.
const { db } = require('../../services/database');
const { scanClusterNodes } = require('../../services/redis');
const { getClient } = require('../../services/redisClient');

const CONN = global.TEST_CONNECTION_ID;
const setTier = (tier) =>
    db.prepare('UPDATE connections SET tier = ? WHERE id = ?').run(tier, CONN);

describe('Tier load budgets, non-clustered', () => {
    let scanSpy;

    beforeEach(async () => {
        scanSpy = jest.spyOn(await getClient(CONN), 'scan');
    });

    afterEach(() => {
        scanSpy.mockRestore();
        setTier('local');
    });

    test('production caps COUNT at 5,000 and pauses before a continuation hop', async () => {
        setTier('production');
        await scanClusterNodes('test:budget:*', ['0'], 20000, CONN);
        expect(scanSpy.mock.calls[0][1].COUNT).toBe(5000);

        const started = Date.now();
        await scanClusterNodes('test:budget:*', ['1'], 20000, CONN);
        expect(Date.now() - started).toBeGreaterThanOrEqual(19);
    });

    test('local passes COUNT through unchanged', async () => {
        setTier('local');
        await scanClusterNodes('test:budget:*', ['0'], 20000, CONN);
        expect(scanSpy.mock.calls[0][1].COUNT).toBe(20000);
    });
});
