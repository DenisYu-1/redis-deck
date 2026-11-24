/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const { db } = require('../../services/database');
const { setAiAccess } = require('../../services/aiAccess');
const { deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const ID = 'test-mcp-wr';

describe('MCP AI access: write / workflows / ask', () => {
    let mcp;
    let approver;
    const set = (v) =>
        mcp.call('set_key', {
            connectionId: ID,
            key: 'test:mcp:wr:k',
            value: v
        });
    const setTier = (tier) =>
        db
            .prepare('UPDATE connections SET tier = ? WHERE id = ?')
            .run(tier, ID);

    beforeEach(async () => {
        addGuardedConnection(ID, {});
        approver = jest.fn(async () => 'once');
        mcp = await connectMcp({ approver });
        await deleteTestKeys('test:mcp:wr:*', CONN);
    });
    afterEach(async () => {
        await mcp.close();
        db.prepare('DELETE FROM ai_access WHERE connection_id = ?').run(ID);
        db.prepare('DELETE FROM ai_activity WHERE connection_id = ?').run(ID);
        removeConnections(ID);
        await deleteTestKeys('test:mcp:wr:*', CONN);
    });

    it('write off blocks key writes, logged as blocked', async () => {
        const r = await set('v');
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/not allowed.*AI/i);
        expect(approver).not.toHaveBeenCalled();
        const row = db
            .prepare('SELECT result FROM ai_activity WHERE connection_id = ?')
            .get(ID);
        expect(row.result).toBe('blocked');
    });

    it('workflows off blocks run_workflow; plan_workflow stays allowed', async () => {
        setAiAccess(ID, { write: true });
        const args = {
            connectionId: ID,
            fullId: 'examples.set-marker',
            inputs: { id: 1 }
        };
        const run = await mcp.call('run_workflow', args);
        expect(run.ok).toBe(false);
        expect(run.error).toMatch(/not allowed.*AI/i);
        const plan = await mcp.call('plan_workflow', args);
        expect(plan.error ?? '').not.toMatch(/not allowed.*AI/i);
    });

    it('production always asks, whatever is stored', async () => {
        setAiAccess(ID, { write: true });
        db.prepare('UPDATE ai_access SET ask = 0 WHERE connection_id = ?').run(
            ID
        );
        expect((await set('v')).ok).toBe(true);
        expect(approver).toHaveBeenCalledTimes(1);
    });

    it('Confirm writes alone does not prompt; ask off writes right away', async () => {
        db.prepare(
            'UPDATE connections SET confirm_writes = 1 WHERE id = ?'
        ).run(ID);
        setTier('staging');
        setAiAccess(ID, { write: true });
        setAiAccess(ID, { ask: false });
        expect((await set('v')).ok).toBe(true);
        expect(approver).not.toHaveBeenCalled();
    });

    it('Read-only blocks writes whatever AI access says', async () => {
        setAiAccess(ID, { write: true });
        db.prepare('UPDATE connections SET read_only = 1 WHERE id = ?').run(ID);
        const r = await set('v');
        expect(r.ok).toBe(false);
        expect(approver).not.toHaveBeenCalled();
    });

    it('ask needs write or Workflows (server rule)', () => {
        setTier('staging');
        expect(() => setAiAccess(ID, { ask: false })).toThrow(
            /ask needs write or workflows/i
        );
        setAiAccess(ID, { write: true });
        expect(setAiAccess(ID, { ask: false }).ask).toBe(false);
    });
});
