const { isWriteCommand } = require('../../guards/writeGuard');

describe('writeGuard classification matches the redis-cli tokenizer', () => {
    test.each([
        'CONFIG "SET" maxmemory 1',
        'CLIENT "KILL" ID 1',
        'CLUSTER "RESET"',
        "SLOWLOG 'RESET'",
        'MEMORY "PURGE"',
        'LATENCY "RESET"',
        'CONFIG "REWRITE"',
        '--raw CONFIG "SET" a b',
        'CLUSTER ADDSLOTSRANGE 0 10',
        'CLUSTER DELSLOTSRANGE 0 10',
        'CLUSTER BUMPEPOCH',
        'CLUSTER SET-CONFIG-EPOCH 1',
        'CLUSTER SAVECONFIG'
    ])('%s is a write', (cmd) => {
        expect(isWriteCommand(cmd)).toBe(true);
    });
    test('reads stay reads', () => {
        expect(isWriteCommand('"GET" "a b"')).toBe(false);
        expect(isWriteCommand('CONFIG GET maxmemory')).toBe(false);
    });
});

describe('test-connection password', () => {
    const { resolveTestPassword } = require('../../services/connectionTest');
    const saved = { host: 'h', port: 6379, password: 'secret' };
    test('uses stored password when host and port match', () => {
        expect(
            resolveTestPassword({ host: 'h', port: '6379', id: 'x' }, saved)
        ).toBe('secret');
    });
    test('does not leak stored password to another host or port', () => {
        expect(
            resolveTestPassword({ host: 'evil', port: 6379, id: 'x' }, saved)
        ).toBeUndefined();
        expect(
            resolveTestPassword({ host: 'h', port: 1, id: 'x' }, saved)
        ).toBeUndefined();
    });
    test('keeps a supplied password', () => {
        expect(
            resolveTestPassword({ host: 'e', port: 1, password: 'p' }, saved)
        ).toBe('p');
    });
});

describe('redisClient cache', () => {
    const { getClient, dropClient } = require('../../services/redisClient');
    test('dropClient closes the cached client and next getClient is fresh', async () => {
        const id = global.TEST_CONNECTION_ID;
        const a = await getClient(id);
        await dropClient(id);
        expect(a.isOpen).toBe(false);
        const b = await getClient(id);
        expect(b).not.toBe(a);
        await dropClient(id);
    });
});
