/**
 * @jest-environment node
 */
const { db } = require('../../services/database');
const { safeMessage } = require('../../services/mcp/errors');

const ID = 'test-mcp-errors';
const HOST = 'db.internal.example';
const PORT = 16380;
const USER = 'deck user';
const PASS = 'p@ss "wörd"/1';

describe('safeMessage', () => {
    beforeAll(() => {
        db.prepare(
            `INSERT OR REPLACE INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
             VALUES (?, ?, ?, ?, ?, 0, 0, 1000, 'production', 0, 0)`
        ).run(ID, HOST, PORT, USER, PASS);
    });

    afterAll(() => {
        db.prepare('DELETE FROM connections WHERE id = ?').run(ID);
    });

    const leaks = (text) =>
        [HOST, String(PORT), USER, PASS].filter((s) => text.includes(s));

    test('masks host, port, username and password as written', () => {
        const text = safeMessage(
            new Error(
                `redis-cli -h ${HOST} -p ${PORT} --user ${USER} -a ${PASS} failed`
            ),
            ID
        );

        expect(text).toBe('redis-cli -h *** -p *** --user *** -a *** failed');
    });

    test('masks URL-encoded config values', () => {
        const url = `redis://${encodeURIComponent(USER)}:${encodeURIComponent(PASS)}@${HOST}:${PORT}`;

        const text = safeMessage(new Error(`connect failed: ${url}`), ID);

        expect(text).toBe('connect failed: redis://***:***@***:***');
    });

    test('masks JSON-quoted config values', () => {
        const json = JSON.stringify({ username: USER, password: PASS });

        const text = safeMessage(new Error(`bad options ${json}`), ID);

        expect(text).toBe('bad options {"username":"***","password":"***"}');
        expect(leaks(text)).toEqual([]);
    });

    test('leaves numbers that only contain the port alone', () => {
        const text = safeMessage(new Error(`took ${PORT}0 ms on ${HOST}`), ID);

        expect(text).toBe(`took ${PORT}0 ms on ***`);
    });

    test('unknown Connection: message passes through', () => {
        expect(safeMessage(new Error('boom 16380'), 'nope')).toBe('boom 16380');
    });
});
