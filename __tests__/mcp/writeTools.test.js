/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const {
    createTestKey,
    createTestHash,
    createTestZSet,
    getKeyValue,
    getKeyTTL,
    deleteTestKeys
} = require('../helpers/testHelpers');
const { readKey, keyExists } = require('../../services/keyStore');

const CONN = global.TEST_CONNECTION_ID;
const READ_ONLY = 'test-mcp-read-only';
const CONFIRM = 'test-mcp-confirm';

describe('MCP write tools', () => {
    let mcp;

    beforeAll(() => {
        addGuardedConnection(READ_ONLY, { readOnly: true });
        addGuardedConnection(CONFIRM, { confirmWrites: true });
    });

    afterAll(() => {
        removeConnections(READ_ONLY, CONFIRM);
    });

    beforeEach(async () => {
        await deleteTestKeys('test:mcpw:*', CONN);
        mcp = await connectMcp();
    });

    afterEach(async () => {
        await mcp.close();
        await deleteTestKeys('test:mcpw:*', CONN);
    });

    describe('set_key', () => {
        test('writes a string Key with a TTL', async () => {
            const res = await mcp.call('set_key', {
                connectionId: CONN,
                key: 'test:mcpw:str',
                value: 'hello',
                ttl: 300
            });

            expect(res.ok).toBe(true);
            expect(await getKeyValue('test:mcpw:str', CONN)).toBe('hello');
            const ttl = await getKeyTTL('test:mcpw:str', CONN);
            expect(ttl).toBeGreaterThan(290);
        });

        test('replaces a hash Key with the given fields', async () => {
            await createTestHash('test:mcpw:h', { old: '1' }, CONN);

            const res = await mcp.call('set_key', {
                connectionId: CONN,
                key: 'test:mcpw:h',
                type: 'hash',
                value: { a: '1', b: '2' }
            });

            expect(res.ok).toBe(true);
            const { value } = await readKey(CONN, 'test:mcpw:h');
            expect(value).toEqual({ a: '1', b: '2' });
        });
    });

    describe('delete_key', () => {
        test('deletes the Key and says so', async () => {
            await createTestKey('test:mcpw:del', 'v', CONN);

            const res = await mcp.call('delete_key', {
                connectionId: CONN,
                key: 'test:mcpw:del'
            });

            expect(res).toEqual({
                ok: true,
                data: { key: 'test:mcpw:del', deleted: true }
            });
            expect(await keyExists(CONN, 'test:mcpw:del')).toBe(false);
        });
    });

    describe('rename_key', () => {
        test('moves the value to the new name', async () => {
            await createTestKey('test:mcpw:{r}:a', 'v', CONN);

            const res = await mcp.call('rename_key', {
                connectionId: CONN,
                key: 'test:mcpw:{r}:a',
                newKey: 'test:mcpw:{r}:b'
            });

            expect(res.ok).toBe(true);
            expect(await keyExists(CONN, 'test:mcpw:{r}:a')).toBe(false);
            expect(await getKeyValue('test:mcpw:{r}:b', CONN)).toBe('v');
        });

        test('fails clearly when the Key does not exist', async () => {
            const res = await mcp.call('rename_key', {
                connectionId: CONN,
                key: 'test:mcpw:{r}:missing',
                newKey: 'test:mcpw:{r}:b'
            });

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/no such key/i);
        });
    });

    describe('set_ttl / remove_ttl', () => {
        test('set_ttl gives the Key an expiry', async () => {
            await createTestKey('test:mcpw:ttl', 'v', CONN);

            const res = await mcp.call('set_ttl', {
                connectionId: CONN,
                key: 'test:mcpw:ttl',
                seconds: 120
            });

            expect(res.ok).toBe(true);
            const ttl = await getKeyTTL('test:mcpw:ttl', CONN);
            expect(ttl).toBeGreaterThan(110);
            expect(ttl).toBeLessThanOrEqual(120);
        });

        test('remove_ttl makes the Key permanent', async () => {
            await createTestKey('test:mcpw:ttl', 'v', CONN, 300);

            const res = await mcp.call('remove_ttl', {
                connectionId: CONN,
                key: 'test:mcpw:ttl'
            });

            expect(res.ok).toBe(true);
            expect(await getKeyTTL('test:mcpw:ttl', CONN)).toBe(-1);
        });
    });

    describe('zadd', () => {
        test('adds members in place, keeping the others and the TTL', async () => {
            await createTestZSet(
                'test:mcpw:z',
                [{ value: 'a', score: 1 }],
                CONN
            );
            await mcp.call('set_ttl', {
                connectionId: CONN,
                key: 'test:mcpw:z',
                seconds: 300
            });

            const res = await mcp.call('zadd', {
                connectionId: CONN,
                key: 'test:mcpw:z',
                members: [
                    { member: 'b', score: 2 },
                    { member: 'a', score: 5 }
                ]
            });

            expect(res).toEqual({
                ok: true,
                data: { key: 'test:mcpw:z', added: 1 }
            });
            const { value } = await readKey(CONN, 'test:mcpw:z');
            expect(value).toEqual([
                { member: 'b', score: 2 },
                { member: 'a', score: 5 }
            ]);
            expect(await getKeyTTL('test:mcpw:z', CONN)).toBeGreaterThan(290);
        });
    });

    describe('set_hash_field', () => {
        test('sets one field in place, keeping the other fields', async () => {
            await createTestHash('test:mcpw:hf', { keep: 'x' }, CONN);

            const res = await mcp.call('set_hash_field', {
                connectionId: CONN,
                key: 'test:mcpw:hf',
                field: 'f',
                value: 'v'
            });

            expect(res.ok).toBe(true);
            const { value } = await readKey(CONN, 'test:mcpw:hf');
            expect(value).toEqual({ keep: 'x', f: 'v' });
        });
    });

    describe('guard', () => {
        const writes = [
            ['set_key', { key: 'test:mcpw:g', value: 'v' }],
            ['delete_key', { key: 'test:mcpw:g' }],
            ['rename_key', { key: 'test:mcpw:g', newKey: 'test:mcpw:g2' }],
            ['set_ttl', { key: 'test:mcpw:g', seconds: 10 }],
            ['remove_ttl', { key: 'test:mcpw:g' }],
            [
                'zadd',
                { key: 'test:mcpw:g', members: [{ member: 'm', score: 1 }] }
            ],
            ['set_hash_field', { key: 'test:mcpw:g', field: 'f', value: 'v' }]
        ];

        test.each(writes)(
            '%s on a Read-only connection is blocked and changes nothing',
            async (tool, args) => {
                await createTestKey('test:mcpw:g', 'orig', CONN, 500);

                const res = await mcp.call(tool, {
                    connectionId: READ_ONLY,
                    ...args
                });

                expect(res).toEqual({
                    ok: false,
                    error: `Connection '${READ_ONLY}' is read-only`
                });
                expect(await getKeyValue('test:mcpw:g', CONN)).toBe('orig');
                expect(await getKeyTTL('test:mcpw:g', CONN)).toBeGreaterThan(
                    490
                );
            }
        );

        test('a Confirm writes Connection is denied when no approver is given', async () => {
            const res = await mcp.call('set_key', {
                connectionId: CONFIRM,
                key: 'test:mcpw:g',
                value: 'v'
            });

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/user denied/i);
            expect(await keyExists(CONN, 'test:mcpw:g')).toBe(false);
        });

        test('a confirmation sent by the AI client is ignored', async () => {
            const res = await mcp.call('set_key', {
                connectionId: CONFIRM,
                key: 'test:mcpw:g',
                value: 'v',
                confirm: CONFIRM,
                confirmConnection: CONFIRM,
                'x-confirm-connection': CONFIRM
            });

            expect(res.ok).toBe(false);
            expect(await keyExists(CONN, 'test:mcpw:g')).toBe(false);
        });

        test('an unknown Connection fails without touching Redis', async () => {
            const res = await mcp.call('set_key', {
                connectionId: 'no-such-connection',
                key: 'test:mcpw:g',
                value: 'v'
            });

            expect(res).toEqual({
                ok: false,
                error: "Connection 'no-such-connection' not found"
            });
        });
    });

    describe('tool list', () => {
        test('exposes exactly the read, guarded write and Workflow tools', async () => {
            const { tools } = await mcp.client.listTools();

            expect(tools.map((t) => t.name).sort()).toEqual(
                [
                    'list_connections',
                    'scan_keys',
                    'get_key',
                    'get_info',
                    'set_key',
                    'delete_key',
                    'rename_key',
                    'set_ttl',
                    'remove_ttl',
                    'zadd',
                    'set_hash_field',
                    'list_workflows',
                    'plan_workflow',
                    'run_workflow'
                ].sort()
            );
        });

        test('write tools are not marked read-only', async () => {
            const { tools } = await mcp.client.listTools();
            const setKey = tools.find((t) => t.name === 'set_key');

            expect(setKey.annotations.readOnlyHint).toBe(false);
        });
    });
});
