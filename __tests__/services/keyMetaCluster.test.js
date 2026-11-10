jest.mock('../../services/redis', () => ({
    isClusterMode: jest.fn().mockResolvedValue(true),
    execArgv: jest.fn()
}));
jest.mock('../../services/redisClient', () => ({ getClient: jest.fn() }));
const { execArgv } = require('../../services/redis');
const { pageMeta } = require('../../services/keyMeta');

test('cluster page meta follows MOVED redirects', async () => {
    execArgv.mockImplementation(async (argv, id, node) => {
        if (!node) {
            throw { message: 'MOVED 1 10.0.0.2:7001' };
        }
        expect(node).toEqual({ host: '10.0.0.2', port: 7001 });
        return { TYPE: 'string', TTL: 5, MEMORY: 64 }[argv[0]];
    });
    const meta = await pageMeta('c', ['k']);
    expect(meta.k).toEqual({ type: 'string', ttl: 5, size: 64 });
});
