/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { db } = require('../../services/database');
const { setToolEnabled } = require('../../services/mcp/toolSwitches');
const { listActivity } = require('../../services/aiActivity');

const CONN = global.TEST_CONNECTION_ID;

const names = async (mcp) =>
    (await mcp.client.listTools()).tools.map((t) => t.name);

describe('MCP tool switches', () => {
    let mcp;

    beforeEach(async () => {
        db.prepare('DELETE FROM settings').run();
        db.prepare('DELETE FROM ai_activity').run();
        mcp = await connectMcp();
    });

    afterEach(async () => {
        await mcp.close();
    });

    it('lists every tool except run_workflow by default', async () => {
        const list = await names(mcp);
        expect(list).toContain('get_key');
        expect(list).toContain('set_key');
        expect(list).not.toContain('run_workflow');
    });

    it('drops a turned-off tool from the list of a new session', async () => {
        setToolEnabled('get_info', false);
        const fresh = await connectMcp();
        try {
            expect(await names(fresh)).not.toContain('get_info');
        } finally {
            await fresh.close();
        }
    });

    it('refuses a call to a tool turned off after the list was cached', async () => {
        setToolEnabled('scan_keys', false);
        const res = await mcp.call('scan_keys', {
            connectionId: CONN,
            pattern: 'test:*'
        });
        expect(res.ok).toBe(false);
        expect(res.error).toBe('tool is turned off');
    });

    it('logs the refusal of a write tool as blocked', async () => {
        setToolEnabled('set_key', false);
        const res = await mcp.call('set_key', {
            connectionId: CONN,
            key: 'test:sw:k',
            value: 'v'
        });
        expect(res).toEqual({ ok: false, error: 'tool is turned off' });
        const { entries } = listActivity();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            operation: 'set_key',
            result: 'blocked',
            error: 'tool is turned off'
        });
    });

    it('applies a switch turned back on without a new session', async () => {
        setToolEnabled('get_info', false);
        setToolEnabled('get_info', true);
        const res = await mcp.call('get_info', { connectionId: CONN });
        expect(res.ok).toBe(true);
    });
});
