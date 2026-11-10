const ks = require('../../services/keyStore');
const { deleteTestKeys } = require('../helpers/testHelpers');

describe('keyStore', () => {
    const conn = global.TEST_CONNECTION_ID;
    beforeEach(() => deleteTestKeys('test:*', conn));

    const cases = {
        string: 'v"a\nl\'ue',
        hash: { a: '1', 'b"q': 'x y' },
        list: ['a', 'b', 'a'],
        set: ['m1', 'm2'],
        zset: [
            { member: 'x', score: 1 },
            { member: 'y"', score: 2.5 }
        ]
    };

    test.each(Object.entries(cases))(
        'write/read/copy %s',
        async (type, value) => {
            const key = `test:ks:${type}"quote`;
            await ks.writeKey(conn, key, type, value, 100);
            const got = await ks.readKey(conn, key);
            expect(got.type).toBe(type);
            expect(got.ttl).toBeGreaterThan(0);
            expect(type === 'set' ? got.value.sort() : got.value).toEqual(
                value
            );

            await ks.copyKey(conn, key, conn, `${key}:copy`);
            const copy = await ks.readKey(conn, `${key}:copy`);
            expect(copy.value).toEqual(got.value);
            expect(copy.ttl).toBeGreaterThan(0);
        }
    );

    test('rewrite drops old members; missing key throws; empty rejected', async () => {
        await ks.writeKey(conn, 'test:ks:l', 'list', ['a', 'b']);
        await ks.writeKey(conn, 'test:ks:l', 'list', ['c']);
        expect((await ks.readKey(conn, 'test:ks:l')).value).toEqual(['c']);
        await expect(ks.readKey(conn, 'test:ks:none')).rejects.toThrow(
            'Key not found'
        );
        await expect(
            ks.writeKey(conn, 'test:ks:e', 'set', [])
        ).rejects.toThrow();
        expect(await ks.keyExists(conn, 'test:ks:l')).toBe(true);
        expect(await ks.deleteKey(conn, 'test:ks:l')).toBe(1);
    });
});

test('stream read', async () => {
    const conn = global.TEST_CONNECTION_ID;
    await require('../../services/redis').execArgv(
        ['XADD', 'test:ks:s', '1-1', 'f', 'v'],
        conn
    );
    expect((await ks.readKey(conn, 'test:ks:s')).value).toEqual([
        { id: '1-1', fields: { f: 'v' } }
    ]);
});
