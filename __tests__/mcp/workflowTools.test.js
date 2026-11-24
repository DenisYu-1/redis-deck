/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { setAiAccess } = require('../../services/aiAccess');
const { keyExists, deleteKey } = require('../../services/keyStore');
const { getHistory } = require('../../services/workflows');
const { db } = require('../../services/database');
const { listActivity } = require('../../services/aiActivity');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');

const CONN = global.TEST_CONNECTION_ID;
const SET = 'examples.set-marker';
const COUNT = 'examples.count-keys';
// Own marker id: routes/workflows.test.js runs the same Workflow with id 7.
const ID = 64;
const MARKER = `workflow:example:${ID}`;
const READ_ONLY = 'test-mcp-wf-read-only';
const CONFIRM = 'test-mcp-wf-confirm';

const runMarker = (mcp, connectionId) =>
    mcp.call('run_workflow', {
        connectionId,
        fullId: SET,
        inputs: { id: ID }
    });

describe('MCP Workflow tools', () => {
    let mcp;

    beforeAll(() => {
        addGuardedConnection(READ_ONLY, { readOnly: true });
        addGuardedConnection(CONFIRM, {});
        setAiAccess(CONFIRM, { write: true, workflows: true });
    });

    afterAll(() => {
        removeConnections(READ_ONLY, CONFIRM);
        // Only this file's runs: other suites share these Connections.
        db.prepare(
            'DELETE FROM workflow_runs WHERE action_id = ? AND inputs LIKE ?'
        ).run(SET, `%"id":${ID},%`);
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
        const setMarker = res.data.workflows.find((w) => w.fullId === SET);
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
            fullId: SET,
            inputs: { id: ID }
        });

        expect(res.ok).toBe(true);
        expect(res.data.text).toBe(
            'Would SET workflow:example:64 to marker with a 60s expiry'
        );
        expect(res.data.inputs).toEqual({ id: ID, ttl: '60' });
        expect(await keyExists(CONN, MARKER)).toBe(false);
    });

    test('run_workflow changes Redis and lands in the Workflow run history', async () => {
        mcp = await connectMcp();

        const res = await mcp.call('run_workflow', {
            connectionId: CONN,
            fullId: SET,
            inputs: { id: String(ID), ttl: '300' }
        });

        expect(res.ok).toBe(true);
        expect(res.data.text).toBe(
            'Set workflow:example:64 to marker (expires in 300s)'
        );
        expect(await keyExists(CONN, MARKER)).toBe(true);
        expect(getHistory(SET)).toContainEqual(
            expect.objectContaining({
                connection: CONN,
                inputs: { id: ID, ttl: '300' },
                ok: true
            })
        );
    });

    test('a run on a plain Connection is logged as done AI activity, naming the Workflow', async () => {
        const NOW = 1_700_000_000_000;
        mcp = await connectMcp({ clock: () => NOW });

        await runMarker(mcp, CONN);

        expect(listActivity({ connectionId: CONN }).entries).toContainEqual(
            expect.objectContaining({
                time: NOW,
                client: 'test-client',
                operation: 'run_workflow',
                target: SET,
                result: 'done',
                error: null
            })
        );
    });

    describe('run guard', () => {
        test('Read-only blocks every run, even a Workflow that does not write', async () => {
            mcp = await connectMcp();

            const res = await mcp.call('run_workflow', {
                connectionId: READ_ONLY,
                fullId: COUNT
            });

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/read-only/);
        });

        test('Read-only still allows plan_workflow', async () => {
            mcp = await connectMcp();

            const res = await mcp.call('plan_workflow', {
                connectionId: READ_ONLY,
                fullId: SET,
                inputs: { id: ID }
            });

            expect(res.ok).toBe(true);
        });

        test('Ask before writes asks the approver, naming the Workflow', async () => {
            const approver = jest.fn(async () => 'deny');
            mcp = await connectMcp({ approver });

            const res = await runMarker(mcp, CONFIRM);

            expect(res.ok).toBe(false);
            expect(res.error).toMatch(/user denied/i);
            expect(approver).toHaveBeenCalledWith(
                {
                    clientName: 'test-client',
                    connectionId: CONFIRM,
                    tier: 'production',
                    operation: 'run_workflow',
                    target: SET,
                    targetLabel: 'Workflow'
                },
                { signal: expect.any(AbortSignal) }
            );
            expect(await keyExists(CONN, MARKER)).toBe(false);
            expect(getHistory(SET).some((r) => r.connection === CONFIRM)).toBe(
                false
            );
        });

        test('Ask before writes runs once the user allows it', async () => {
            mcp = await connectMcp({ approver: async () => 'once' });

            const res = await runMarker(mcp, CONFIRM);

            expect(res.ok).toBe(true);
            expect(await keyExists(CONN, MARKER)).toBe(true);
        });
    });
});
