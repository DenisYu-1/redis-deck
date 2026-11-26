const { lookupCommand } = require('../../services/console/commands');
const { maskConsoleResult } = require('../../services/ai/consoleResult');

const mask = (text, reply) =>
    maskConsoleResult({ text, kind: 'array', reply }, ['password']);

test.each(['MGET', 'SMEMBERS', 'HSCAN', 'XRANGE', 'TIME'])('%s reads', (c) => {
    expect(lookupCommand([c]).entry.access).toBe('read');
});

test.each(['SADD', 'ZADD', 'LPOP', 'MSET', 'HINCRBY', 'XADD'])(
    '%s is a write, so the write guard sees it',
    (c) => {
        expect(lookupCommand([c]).entry.access).toBe('write');
    }
);

test.each(['EVAL', 'EVALSHA', 'BLPOP', 'FLUSHALL', 'MIGRATE', 'SCRIPT LOAD'])(
    '%s stays refused',
    (c) => {
        expect(lookupCommand(c.split(' ')).entry).toBeUndefined();
    }
);

test('hidden fields are masked in the new reply shapes', () => {
    expect(mask('HMGET u name password', ['a', 's3'])).toEqual(['a', '●●●']);
    expect(mask('HINCRBY u password 1', 42)).toBe('●●●');
    expect(mask('HSCAN u 0', ['0', ['password', 's3']])).toEqual([
        '0',
        [['password', '●●●']]
    ]);
    expect(mask('XRANGE s - +', [['1-0', ['password', 's3']]])).toEqual([
        ['1-0', [['password', '●●●']]]
    ]);
    expect(mask('GETRANGE u 14 20', 's3')).toBeUndefined();
});
