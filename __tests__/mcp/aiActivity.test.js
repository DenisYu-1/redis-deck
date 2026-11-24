/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { setAiAccess } = require('../../services/aiAccess');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const { deleteTestKeys } = require('../helpers/testHelpers');
const { db } = require('../../services/database');
const {
    listActivity,
    setLoggingEnabled
} = require('../../services/aiActivity');
const { run } = require('../../services/keyStore');

const CONN = global.TEST_CONNECTION_ID;
const READ_ONLY = 'test-mcp-log-ro';
const CONFIRM = 'test-mcp-log-confirm';
const HIDDEN = 'test-mcp-log-hidden';
const NOW = 1_700_000_000_000;

const entries = () => listActivity({ limit: 50 }).entries;

describe('MCP AI activity log', () => {
    let mcp;

    beforeAll(() => {
        addGuardedConnection(READ_ONLY, { readOnly: true });
        addGuardedConnection(CONFIRM, {});
        setAiAccess(CONFIRM, { write: true, workflows: true });
        addGuardedConnection(HIDDEN, {});
    });

    afterAll(() => {
        removeConnections(READ_ONLY, CONFIRM, HIDDEN);
    });

    beforeEach(async () => {
        db.prepare('DELETE FROM ai_activity').run();
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
        setLoggingEnabled(true);
        await deleteTestKeys('test:mcpl:*', CONN);
    });

    afterEach(async () => {
        await mcp?.close();
        mcp = undefined;
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
        setLoggingEnabled(true);
        await deleteTestKeys('test:mcpl:*', CONN);
    });

    test('a write that runs is logged as ok', async () => {
        mcp = await connectMcp({ clock: () => NOW });

        const res = await mcp.call('set_key', {
            connectionId: CONN,
            key: 'test:mcpl:k',
            value: 'v'
        });

        expect(res.ok).toBe(true);
        expect(entries()).toEqual([
            {
                id: expect.any(Number),
                time: NOW,
                client: 'test-client',
                connectionId: CONN,
                operation: 'set_key',
                target: 'test:mcpl:k',
                result: 'ok',
                error: null,
                args: JSON.stringify({
                    connectionId: CONN,
                    key: 'test:mcpl:k',
                    type: 'string',
                    value: 'v',
                    ttl: 0
                }),
                response: expect.any(String),
                durationMs: expect.any(Number)
            }
        ]);
    });

    test('a write the user denies is logged as denied', async () => {
        mcp = await connectMcp({ approver: async () => 'deny' });

        await mcp.call('delete_key', {
            connectionId: CONFIRM,
            key: 'test:mcpl:k'
        });

        expect(entries()).toMatchObject([
            {
                connectionId: CONFIRM,
                operation: 'delete_key',
                target: 'test:mcpl:k',
                result: 'denied',
                error: expect.stringMatching(/user denied/i)
            }
        ]);
    });

    test('a write on a Read-only Connection is logged as blocked', async () => {
        mcp = await connectMcp();

        await mcp.call('set_key', {
            connectionId: READ_ONLY,
            key: 'test:mcpl:k',
            value: 'v'
        });

        expect(entries()).toMatchObject([
            {
                connectionId: READ_ONLY,
                operation: 'set_key',
                result: 'blocked',
                error: expect.stringMatching(/read-only/)
            }
        ]);
    });

    test('a write that throws is logged as error', async () => {
        mcp = await connectMcp();

        const res = await mcp.call('rename_key', {
            connectionId: CONN,
            key: 'test:mcpl:{r}missing',
            newKey: 'test:mcpl:{r}other'
        });

        expect(res.ok).toBe(false);
        expect(entries()).toMatchObject([
            {
                operation: 'rename_key',
                target: 'test:mcpl:{r}missing',
                result: 'error',
                error: res.error
            }
        ]);
    });

    test('a read is logged with its args, response and duration', async () => {
        mcp = await connectMcp({ clock: () => NOW });
        await mcp.call('set_key', {
            connectionId: CONN,
            key: 'test:mcpl:r',
            value: 'hello'
        });
        db.prepare('DELETE FROM ai_activity').run();

        const res = await mcp.call('get_key', {
            connectionId: CONN,
            key: 'test:mcpl:r'
        });

        const [entry] = entries();
        expect(entries()).toHaveLength(1);
        expect(entry).toMatchObject({
            time: NOW,
            operation: 'get_key',
            result: 'ok',
            connectionId: CONN
        });
        expect(JSON.parse(entry.args)).toEqual({
            connectionId: CONN,
            key: 'test:mcpl:r'
        });
        expect(JSON.parse(entry.response)).toEqual(res.data);
        expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('a call without a Connection is logged with an empty Connection', async () => {
        mcp = await connectMcp();

        await mcp.call('list_connections');

        expect(entries()).toMatchObject([
            { operation: 'list_connections', connectionId: '', result: 'ok' }
        ]);
    });

    test('hidden field values never reach the stored args or response', async () => {
        mcp = await connectMcp();
        await mcp.call('set_key', {
            connectionId: CONN,
            key: 'test:mcpl:h',
            value: JSON.stringify({ name: 'ann', password: 'hunter2' })
        });
        await mcp.call('get_key', { connectionId: CONN, key: 'test:mcpl:h' });

        const stored = entries()
            .map((e) => `${e.args}${e.response}`)
            .join('');
        expect(stored).not.toContain('hunter2');
        expect(stored).toContain('●●●');
        expect(stored).toContain('ann');
    });

    test('a big response is capped', async () => {
        mcp = await connectMcp();
        const fields = Array.from({ length: 60 }, (_, i) => [
            `f${i}`,
            'x'.repeat(200)
        ]).flat();
        await run(CONN, ['HSET', 'test:mcpl:big', ...fields]);
        db.prepare('DELETE FROM ai_activity').run();

        await mcp.call('get_key', {
            connectionId: CONN,
            key: 'test:mcpl:big'
        });

        const [entry] = entries();
        expect(entry.response.length).toBeLessThanOrEqual(4200);
        expect(entry.response.length).toBeGreaterThan(1000);
    });

    test('a read on a Connection hidden from AI is logged as blocked', async () => {
        mcp = await connectMcp();
        setAiAccess(HIDDEN, { keys: false });

        await mcp.call('get_key', {
            connectionId: HIDDEN,
            key: 'test:mcpl:k'
        });

        expect(entries()).toMatchObject([
            { operation: 'get_key', result: 'blocked' }
        ]);
    });

    test.each([
        ['claude-ai', 'Claude Desktop'],
        ['claude-code', 'Claude Code'],
        ['codex-mcp-client', 'Codex'],
        ['cursor-vscode', 'Cursor'],
        ['my-odd-client', 'my-odd-client']
    ])('client %s is labelled %s', async (name, label) => {
        mcp = await connectMcp({ clientName: name });

        await mcp.call('list_connections');

        expect(entries()[0].client).toBe(label);
    });

    test('nothing is logged while "Log AI operations" is off', async () => {
        mcp = await connectMcp();
        setLoggingEnabled(false);

        await mcp.call('list_connections');
        await mcp.call('set_key', {
            connectionId: CONN,
            key: 'test:mcpl:k',
            value: 'v'
        });
        await mcp.call('set_key', {
            connectionId: READ_ONLY,
            key: 'test:mcpl:k',
            value: 'v'
        });

        expect(entries()).toEqual([]);
    });
});
