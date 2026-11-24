/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { db } = require('../../services/database');
const { setAiAccess } = require('../../services/aiAccess');
const { createTestKey, deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;

describe('MCP AI access: see keys / see values', () => {
    let mcp;
    beforeEach(async () => {
        await deleteTestKeys('test:mcp:acc:*', CONN);
        await createTestKey('test:mcp:acc:k', 'secret-value', CONN);
        mcp = await connectMcp();
    });
    afterEach(async () => {
        await mcp.close();
        db.prepare('DELETE FROM ai_access WHERE connection_id = ?').run(CONN);
        await deleteTestKeys('test:mcp:acc:*', CONN);
    });

    it('see keys off hides the Connection and refuses every tool', async () => {
        setAiAccess(CONN, { keys: false });
        const list = await mcp.call('list_connections');
        expect(list.data.connections.map((c) => c.id)).not.toContain(CONN);
        for (const [name, args] of [
            ['scan_keys', { pattern: '*' }],
            ['get_key', { key: 'test:mcp:acc:k' }],
            ['get_info', {}]
        ]) {
            const r = await mcp.call(name, { connectionId: CONN, ...args });
            expect(r).toEqual({
                ok: false,
                error: expect.stringContaining('not available to AI clients')
            });
        }
    });

    it('see values off: get_key has no value, scan_keys still lists', async () => {
        setAiAccess(CONN, { values: false });
        const r = await mcp.call('get_key', {
            connectionId: CONN,
            key: 'test:mcp:acc:k'
        });
        expect(r.ok).toBe(true);
        expect(r.data).toMatchObject({ key: 'test:mcp:acc:k', type: 'string' });
        expect(r.data).not.toHaveProperty('value');
        expect(JSON.stringify(r.data)).not.toContain('secret-value');
        const scan = await mcp.call('scan_keys', {
            connectionId: CONN,
            pattern: 'test:mcp:acc:*'
        });
        expect(scan.data.keys).toEqual(['test:mcp:acc:k']);
    });

    it('see values on returns the value', async () => {
        const r = await mcp.call('get_key', {
            connectionId: CONN,
            key: 'test:mcp:acc:k'
        });
        expect(r.data.value).toBe('secret-value');
    });
});
