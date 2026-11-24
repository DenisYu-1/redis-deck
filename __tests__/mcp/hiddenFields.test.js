/**
 * @jest-environment node
 */
const { connectMcp } = require('../helpers/mcpClient');
const { db } = require('../../services/database');
const { run } = require('../../services/keyStore');
const { setHiddenFields } = require('../../services/hiddenFields');
const { deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const MASK = '●●●';

describe('MCP get_key hidden fields', () => {
    let mcp;

    beforeEach(async () => {
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
        await deleteTestKeys('test:mcp:hf:*', CONN);
        mcp = await connectMcp();
    });

    afterEach(async () => {
        await mcp.close();
        db.prepare("DELETE FROM settings WHERE key = 'hidden_fields'").run();
        await deleteTestKeys('test:mcp:hf:*', CONN);
    });

    const get = async (key) =>
        (await mcp.call('get_key', { connectionId: CONN, key })).data;

    test('masks hash fields by exact, case-insensitive name', async () => {
        await run(CONN, [
            'HSET',
            'test:mcp:hf:h',
            'Password',
            'p1',
            'name',
            'bob',
            'password2',
            'keep'
        ]);

        const data = await get('test:mcp:hf:h');

        expect(data.value).toEqual({
            Password: MASK,
            name: 'bob',
            password2: 'keep'
        });
    });

    test('masks nested JSON keys at any depth', async () => {
        await run(CONN, [
            'SET',
            'test:mcp:hf:j',
            JSON.stringify({ a: { list: [{ TOKEN: 't', ok: 1 }] }, b: 2 })
        ]);

        const data = await get('test:mcp:hf:j');

        expect(JSON.parse(data.value)).toEqual({
            a: { list: [{ TOKEN: MASK, ok: 1 }] },
            b: 2
        });
    });

    test('leaves non-JSON strings unchanged', async () => {
        await run(CONN, ['SET', 'test:mcp:hf:s', 'password=hunter2']);

        expect((await get('test:mcp:hf:s')).value).toBe('password=hunter2');
    });

    test('masks before truncation', async () => {
        const big = JSON.stringify({
            secret: 'x'.repeat(10),
            pad: 'y'.repeat(5000)
        });
        await run(CONN, ['SET', 'test:mcp:hf:t', big]);

        const data = await get('test:mcp:hf:t');

        expect(data.truncated).toBe(true);
        expect(data.value).not.toContain('xxxxxxxxxx');
        expect(data.value).toContain(MASK);
    });

    test('uses the configured list at call time', async () => {
        await run(CONN, ['HSET', 'test:mcp:hf:c', 'password', 'p', 'ssn', '1']);
        setHiddenFields(['SSN']);

        const data = await get('test:mcp:hf:c');

        expect(data.value).toEqual({ password: 'p', ssn: MASK });
    });
});
