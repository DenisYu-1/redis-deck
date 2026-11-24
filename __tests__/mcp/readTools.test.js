/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { db } = require('../../services/database');
const { scanClusterNodes } = require('../../services/redis');
const { run } = require('../../services/keyStore');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

const SECRET_ID = 'test-mcp-secret';
const CONN = global.TEST_CONNECTION_ID;

describe('MCP read tools', () => {
    let mcp;

    beforeAll(() => {
        db.prepare(
            `INSERT OR REPLACE INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
             VALUES (?, '127.0.0.1', 1, 'leaky-user', 'leaky-pass-123', 1, 0, 1000, 'production', 1, 1)`
        ).run(SECRET_ID);
    });

    afterAll(() => {
        db.prepare('DELETE FROM connections WHERE id = ?').run(SECRET_ID);
    });

    // Bulk scan Keys share one hash slot so MSET/DEL work on clusters too;
    // one DEL keeps cleanup of hundreds of Keys to a single spawn.
    async function clearKeys() {
        const keys = [];
        let cursors = ['0'];
        let hasMore = true;
        while (hasMore) {
            const r = await scanClusterNodes(
                'test:mcp:{scan}:*',
                cursors,
                10000,
                CONN
            );
            keys.push(...r.keys);
            ({ cursors, hasMore } = r);
        }
        if (keys.length > 0) {
            await run(CONN, ['DEL', ...new Set(keys)]);
        }
        await deleteTestKeys('test:mcp:*', CONN);
    }

    beforeEach(async () => {
        await clearKeys();
        mcp = await connectMcp();
    });

    afterEach(async () => {
        await mcp.close();
        await clearKeys();
    });

    describe('list_connections', () => {
        test('lists id, name, Tier and safety flags, without secrets', async () => {
            const { ok, data } = await mcp.call('list_connections');

            expect(ok).toBe(true);
            const conn = data.connections.find((c) => c.id === SECRET_ID);
            expect(conn).toEqual({
                id: SECRET_ID,
                name: SECRET_ID,
                tier: 'production',
                readOnly: true,
                confirmWrites: true
            });
            const text = JSON.stringify(data);
            expect(text).not.toContain('leaky-pass-123');
            expect(text).not.toContain('leaky-user');
        });
    });

    describe('scan_keys', () => {
        const mset = (n) =>
            run(CONN, [
                'MSET',
                ...Array.from({ length: n }, (_, i) => [
                    `test:mcp:{scan}:${i}`,
                    'v'
                ]).flat()
            ]);

        test('returns the matching Keys when under the count', async () => {
            await mset(30);
            await createTestKey('test:mcp:other', 'v', CONN);

            const { data } = await mcp.call('scan_keys', {
                connectionId: CONN,
                pattern: 'test:mcp:{scan}:*',
                count: 100
            });

            expect(data.keys).toHaveLength(30);
            expect(
                data.keys.every((k) => k.startsWith('test:mcp:{scan}:'))
            ).toBe(true);
            expect(data.truncated).toBe(false);
        });

        test('stops at count and says the result is truncated', async () => {
            await mset(30);

            const { data } = await mcp.call('scan_keys', {
                connectionId: CONN,
                pattern: 'test:mcp:{scan}:*',
                count: 5
            });

            expect(data.keys).toHaveLength(5);
            expect(data.truncated).toBe(true);
        });

        test('caps count at 500', async () => {
            await mset(600);

            const { data } = await mcp.call('scan_keys', {
                connectionId: CONN,
                pattern: 'test:mcp:{scan}:*',
                count: 10000
            });

            expect(data.keys).toHaveLength(500);
            expect(data.truncated).toBe(true);
        });
    });

    describe('get_key', () => {
        test('returns type, TTL, size and the whole small value', async () => {
            await createTestKey('test:mcp:str', 'hello', CONN, 300);

            const { ok, data } = await mcp.call('get_key', {
                connectionId: CONN,
                key: 'test:mcp:str'
            });

            expect(ok).toBe(true);
            expect(data).toMatchObject({
                key: 'test:mcp:str',
                type: 'string',
                value: 'hello',
                truncated: false
            });
            expect(data.ttl).toBeGreaterThan(290);
            expect(data.ttl).toBeLessThanOrEqual(300);
            expect(data.size.length).toBe(5);
            expect(data.size.bytes).toBeGreaterThan(0);
        });

        test('truncates a long string value to 4096 characters', async () => {
            await run(CONN, ['SET', 'test:mcp:big', 'x'.repeat(20000)]);

            const { data } = await mcp.call('get_key', {
                connectionId: CONN,
                key: 'test:mcp:big'
            });

            expect(data.value).toBe('x'.repeat(4096));
            expect(data.truncated).toBe(true);
            expect(data.size.length).toBe(20000);
        });

        test('truncates a large hash to its first 100 fields', async () => {
            const fields = Array.from({ length: 300 }, (_, i) => [
                `f${i}`,
                'v'
            ]).flat();
            await run(CONN, ['HSET', 'test:mcp:hash', ...fields]);

            const { data } = await mcp.call('get_key', {
                connectionId: CONN,
                key: 'test:mcp:hash'
            });

            expect(data.type).toBe('hash');
            expect(Object.keys(data.value)).toHaveLength(100);
            expect(data.truncated).toBe(true);
            expect(data.size.length).toBe(300);
        });

        test('truncates a large list to its first 100 items', async () => {
            const items = Array.from({ length: 300 }, (_, i) => `i${i}`);
            await run(CONN, ['RPUSH', 'test:mcp:list', ...items]);

            const { data } = await mcp.call('get_key', {
                connectionId: CONN,
                key: 'test:mcp:list'
            });

            expect(data.value).toEqual(items.slice(0, 100));
            expect(data.truncated).toBe(true);
        });

        test('fails with Key not found for a missing Key', async () => {
            const res = await mcp.call('get_key', {
                connectionId: CONN,
                key: 'test:mcp:missing'
            });

            expect(res).toEqual({ ok: false, error: 'Key not found' });
        });
    });

    describe('get_info', () => {
        test('returns INFO parsed into sections', async () => {
            const { ok, data } = await mcp.call('get_info', {
                connectionId: CONN
            });

            expect(ok).toBe(true);
            expect(data.server.redis_version).toMatch(/^\d+\.\d+/);
            expect(data.memory).toHaveProperty('used_memory');
        });

        test('returns one section when asked', async () => {
            const { data } = await mcp.call('get_info', {
                connectionId: CONN,
                section: 'memory'
            });

            expect(Object.keys(data)).toEqual(['memory']);
        });
    });

    describe('errors', () => {
        const realCli = process.env.REDIS_CLI_PATH;

        // A redis-cli that fails silently: Node's error text is then the
        // whole command line, connection flags included.
        beforeEach(() => {
            process.env.REDIS_CLI_PATH = '/usr/bin/false';
        });

        afterEach(() => {
            if (realCli === undefined) {
                delete process.env.REDIS_CLI_PATH;
            } else {
                process.env.REDIS_CLI_PATH = realCli;
            }
        });

        test.each([
            ['get_key', { key: 'test:mcp:x' }],
            ['get_info', {}]
        ])('%s errors never echo Connection config', async (tool, args) => {
            const res = await mcp.call(tool, {
                connectionId: SECRET_ID,
                ...args
            });

            expect(res.ok).toBe(false);
            expect(res.error).not.toContain('leaky-pass-123');
            expect(res.error).not.toContain('leaky-user');
            expect(res.error).not.toContain('127.0.0.1');
        });
    });
});
