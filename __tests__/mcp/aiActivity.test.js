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

const CONN = global.TEST_CONNECTION_ID;
const READ_ONLY = 'test-mcp-log-ro';
const CONFIRM = 'test-mcp-log-confirm';
const NOW = 1_700_000_000_000;

const entries = () => listActivity({ limit: 50 }).entries;

describe('MCP AI activity log', () => {
    let mcp;

    beforeAll(() => {
        addGuardedConnection(READ_ONLY, { readOnly: true });
        addGuardedConnection(CONFIRM, {});
        setAiAccess(CONFIRM, { write: true, workflows: true });
    });

    afterAll(() => {
        removeConnections(READ_ONLY, CONFIRM);
    });

    beforeEach(async () => {
        db.prepare('DELETE FROM ai_activity').run();
        setLoggingEnabled(true);
        await deleteTestKeys('test:mcpl:*', CONN);
    });

    afterEach(async () => {
        await mcp?.close();
        mcp = undefined;
        setLoggingEnabled(true);
        await deleteTestKeys('test:mcpl:*', CONN);
    });

    test('a write that runs is logged as done', async () => {
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
                result: 'done',
                error: null
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

    test('a write that throws is logged as failed', async () => {
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
                result: 'failed',
                error: res.error
            }
        ]);
    });

    test('reads are not logged', async () => {
        mcp = await connectMcp();

        await mcp.call('list_connections');
        await mcp.call('get_key', {
            connectionId: CONN,
            key: 'test:mcpl:none'
        });

        expect(entries()).toEqual([]);
    });

    test('nothing is logged while "Log AI operations" is off', async () => {
        mcp = await connectMcp();
        setLoggingEnabled(false);

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
