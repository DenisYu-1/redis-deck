jest.mock('../../services/redis', () => ({
    isClusterMode: jest.fn().mockResolvedValue(true),
    execArgv: jest.fn(),
    execArgvBatch: jest.fn(),
    getClusterNodes: jest.fn()
}));
jest.mock('../../services/redisClient', () => ({ getClient: jest.fn() }));
const {
    execArgv,
    execArgvBatch,
    getClusterNodes
} = require('../../services/redis');
const { pageMeta } = require('../../services/keyMeta');

const A = { id: 'a', host: '10.0.0.1', port: 7000 };
const B = { id: 'b', host: '10.0.0.2', port: 7001 };

beforeEach(() => {
    jest.clearAllMocks();
    getClusterNodes.mockResolvedValue([A, B]);
});

test('cluster page meta follows MOVED redirects for a Key without a Node', async () => {
    execArgv.mockImplementation(async (argv, id, node) => {
        if (!node) {
            throw { message: 'MOVED 1 10.0.0.2:7001' };
        }
        expect(node).toEqual({ host: '10.0.0.2', port: 7001 });
        return { TYPE: 'string', TTL: 5, MEMORY: 64 }[argv[0]];
    });
    const meta = await pageMeta('c', ['k']);
    expect(meta.k).toEqual({ type: 'string', ttl: 5, size: 64, node: 'b' });
});

test('one batch per Node; replies align per Key, nil size included', async () => {
    const replies = {
        a: [{ value: 'hash' }, { value: -1 }, { value: null }],
        b: [
            { value: 'string' },
            { value: 30 },
            { value: 72 },
            { value: 'none' },
            { value: -2 },
            { value: null }
        ]
    };
    execArgvBatch.mockImplementation(async (cmds, id, node) => {
        expect(cmds).toHaveLength(replies[node.id].length);
        return replies[node.id];
    });
    const meta = await pageMeta('c', ['h', 's', 'gone'], {
        h: A,
        s: B,
        gone: B
    });
    expect(execArgvBatch).toHaveBeenCalledTimes(2);
    expect(execArgv).not.toHaveBeenCalled();
    expect(meta).toEqual({
        h: { type: 'hash', ttl: -1, size: null, node: 'a' },
        s: { type: 'string', ttl: 30, size: 72, node: 'b' },
        gone: { type: 'none', ttl: -2, size: null, node: 'b' }
    });
});

test('a Key moved by a reshard is retried once through owner discovery', async () => {
    execArgvBatch.mockResolvedValue([
        { error: 'MOVED 1 10.0.0.2:7001' },
        { error: 'MOVED 1 10.0.0.2:7001' },
        { error: 'MOVED 1 10.0.0.2:7001' }
    ]);
    execArgv.mockImplementation(async (argv, id, node) => {
        if (!node) {
            throw { message: 'MOVED 1 10.0.0.2:7001' };
        }
        return { TYPE: 'set', TTL: -1, MEMORY: 40 }[argv[0]];
    });
    const meta = await pageMeta('c', ['k'], { k: A });
    expect(meta.k).toEqual({ type: 'set', ttl: -1, size: 40, node: 'b' });
});
