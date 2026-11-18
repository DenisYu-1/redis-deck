/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { keyExists, deleteKey } = require('../../services/keyStore');
const { getHistory } = require('../../services/workflows');
const { db } = require('../../services/database');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');

const CONN = global.TEST_CONNECTION_ID;
const SET = 'examples.set-marker';
const COUNT = 'examples.count-keys';
const MARKER = 'workflow:example:7';
const READ_ONLY = 'test-mcp-wf-read-only';
const CONFIRM = 'test-mcp-wf-confirm';

const runMarker = (mcp, connectionId) =>
    mcp.call('run_workflow', {
        connectionId,
        workflowId: SET,
        inputs: { id: 7 }
    });

describe('MCP Workflow tools', () => {
    let mcp;

    beforeAll(() => {
        addGuardedConnection(READ_ONLY, { readOnly: true });
        addGuardedConnection(CONFIRM, { confirmWrites: true });
    });

    afterAll(() => {
        removeConnections(READ_ONLY, CONFIRM);
        db.prepare(
            'DELETE FROM workflow_runs WHERE connection_id IN (?, ?, ?)'
        ).run(CONN, READ_ONLY, CONFIRM);
    });

    afterEach(async () => {
        await mcp?.close();
        mcp = undefined;
        await deleteKey(CONN, MARKER);
    });

    test('list_workflows returns each Workflow with its inputs', async () => {
        mcp = await connectMcp();

        const res = await mcp.call('list_workflows');

        expect(res.ok).toBe(true);
        const setMarker = res.data.workflows.find((w) => w.id === SET);
        expect(setMarker).toMatchObject({
            title: 'Set marker key',
            writes: true
        });
        expect(setMarker.inputs.map((i) => [i.name, i.type])).toEqual([
            ['id', 'int'],
            ['token', 'uuid'],
            ['ttl', 'select']
        ]);
        expect(setMarker.inputs[2].options).toEqual(['60', '300', '3600']);
    });

    test('plan_workflow describes the change and writes nothing', async () => {
        mcp = await connectMcp();

        const res = await mcp.call('plan_workflow', {
            connectionId: CONN,
            workflowId: SET,
            inputs: { id: 7 }
        });

        expect(res.ok).toBe(true);
        expect(res.data.text).toBe(
            'Would SET workflow:example:7 to marker with a 60s expiry'
        );
        expect(res.data.inputs).toEqual({ id: 7, ttl: '60' });
        expect(await keyExists(CONN, MARKER)).toBe(false);
    });

    test('run_workflow changes Redis and lands in the Workflow run history', async () => {
        mcp = await connectMcp();

        const res = await mcp.call('run_workflow', {
            connectionId: CONN,
            workflowId: SET,
            inputs: { id: '7', ttl: '300' }
        });

        expect(res.ok).toBe(true);
        expect(res.data.text).toBe(
            'Set workflow:example:7 to marker (expires in 300s)'
        );
        expect(await keyExists(CONN, MARKER)).toBe(true);
        expect(getHistory(SET)[0]).toMatchObject({
            connection: CONN,
            inputs: { id: 7, ttl: '300' },
            ok: true
        });
    });

    describe('run guard', () => {
        test('Read-only blocks every run, even a Workflow that does not write', async () => {
            mcp = await connectMcp();

            const res = await mcp.call('run_workflow', {
                connectionId: READ_ONLY,
                workflowId: COUNT
            });

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/read-only/);
        });

        test('Read-only still allows plan_workflow', async () => {
            mcp = await connectMcp();

            const res = await mcp.call('plan_workflow', {
                connectionId: READ_ONLY,
                workflowId: SET,
                inputs: { id: 7 }
            });

            expect(res.ok).toBe(true);
        });

        test('Confirm writes asks the approver, naming the Workflow', async () => {
            const approver = jest.fn(async () => 'deny');
            mcp = await connectMcp({ approver });

            const res = await runMarker(mcp, CONFIRM);

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/user denied/i);
            expect(approver).toHaveBeenCalledWith({
                clientName: 'test-client',
                connectionId: CONFIRM,
                tier: 'production',
                operation: 'run_workflow',
                key: SET
            });
            expect(await keyExists(CONN, MARKER)).toBe(false);
            expect(getHistory(SET).some((r) => r.connection === CONFIRM)).toBe(
                false
            );
        });

        test('Confirm writes runs once the user allows it', async () => {
            mcp = await connectMcp({ approver: async () => 'once' });

            const res = await runMarker(mcp, CONFIRM);

            expect(res.ok).toBe(true);
            expect(await keyExists(CONN, MARKER)).toBe(true);
        });
    });
});
