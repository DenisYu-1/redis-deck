jest.mock('../../services/redis', () => ({
    isClusterMode: jest.fn().mockResolvedValue(true),
    execArgvBatch: jest.fn(),
    getClusterNodes: jest.fn()
}));
jest.mock('../../services/redisClient', () => ({ getClient: jest.fn() }));
const { execArgvBatch, getClusterNodes } = require('../../services/redis');
const { pageMeta, keySizes } = require('../../services/keyMeta');

const A = { id: 'a', host: '10.0.0.1', port: 7000 };
const B = { id: 'b', host: '10.0.0.2', port: 7001 };

beforeEach(() => {
    jest.clearAllMocks();
    getClusterNodes.mockResolvedValue([A, B]);
});

test('cluster page meta follows MOVED redirects for a Key without a Node', async () => {
    execArgvBatch.mockImplementation(async (cmds, id, node) => {
        if (!node) {
            return cmds.map(() => ({ error: 'MOVED 1 10.0.0.2:7001' }));
        }
        expect(node).toEqual(B);
        return [{ value: 'string' }, { value: 5 }];
    });
    const meta = await pageMeta('c', ['k']);
    expect(execArgvBatch).toHaveBeenCalledTimes(2);
    expect(meta.k).toEqual({ type: 'string', ttl: 5, node: 'b' });
});

test('one batch per Node; replies align per Key', async () => {
    const replies = {
        a: [{ value: 'hash' }, { value: -1 }],
        b: [
            { value: 'string' },
            { value: 30 },
            { value: 'none' },
            { value: -2 }
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
    expect(meta).toEqual({
        h: { type: 'hash', ttl: -1, node: 'a' },
        s: { type: 'string', ttl: 30, node: 'b' },
        gone: { type: 'none', ttl: -2, node: 'b' }
    });
});

test('a Key moved by a reshard is retried once on its new owner', async () => {
    execArgvBatch.mockImplementation(async (cmds, id, node) =>
        node === A
            ? cmds.map(() => ({ error: 'MOVED 1 10.0.0.2:7001' }))
            : [{ value: 'set' }, { value: -1 }]
    );
    const meta = await pageMeta('c', ['k'], { k: A });
    expect(execArgvBatch).toHaveBeenCalledTimes(2);
    expect(meta.k).toEqual({ type: 'set', ttl: -1, node: 'b' });
});

test('a Key still redirected after the retry is an error', async () => {
    execArgvBatch.mockImplementation(async (cmds) =>
        cmds.map(() => ({ error: 'MOVED 1 10.0.0.2:7001' }))
    );
    await expect(pageMeta('c', ['k'], { k: A })).rejects.toMatchObject({
        message: 'MOVED 1 10.0.0.2:7001'
    });
});

describe('lazy size on clusters (R4)', () => {
    test('Page meta carries type, TTL and Node but no size', async () => {
        execArgvBatch.mockImplementation(async (cmds) => {
            expect(cmds).toEqual([
                ['TYPE', 'k'],
                ['TTL', 'k']
            ]);
            return [{ value: 'string' }, { value: -1 }];
        });
        const meta = await pageMeta('c', ['k'], { k: A });
        expect(meta.k).toEqual({ type: 'string', ttl: -1, node: 'a' });
    });

    test('keySizes: one MEMORY USAGE batch per Node id; missing Key is null', async () => {
        const sizes = {
            a: [{ value: 56 }],
            b: [{ value: 72 }, { value: null }]
        };
        execArgvBatch.mockImplementation(async (cmds, id, node) => {
            cmds.forEach((c) =>
                expect(c.slice(0, 2)).toEqual(['MEMORY', 'USAGE'])
            );
            return sizes[node.id];
        });
        const out = await keySizes('c', [
            { key: 'h', node: 'a' },
            { key: 's', node: 'b' },
            { key: 'gone', node: 'b' }
        ]);
        expect(execArgvBatch).toHaveBeenCalledTimes(2);
        expect(out).toEqual({ h: 56, s: 72, gone: null });
    });

    test('keySizes: a Key with an unknown Node id is found through MOVED', async () => {
        execArgvBatch.mockImplementation(async (cmds, id, node) =>
            node ? [{ value: 40 }] : [{ error: 'MOVED 1 10.0.0.2:7001' }]
        );
        const out = await keySizes('c', [{ key: 'k', node: 'stale' }]);
        expect(execArgvBatch).toHaveBeenCalledTimes(2);
        expect(out).toEqual({ k: 40 });
    });
});
