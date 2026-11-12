const path = require('path');
const {
    bundledRedisCliPath,
    applyBundledRedisCli
} = require('../../electron/redisCli');

describe('bundled redis-cli selection', () => {
    const resources = '/Apps/Redis Deck.app/Contents/Resources';
    const darwinBin = path.join(resources, 'redis-cli', 'redis-cli');

    it('points at redis-cli inside resources', () => {
        expect(bundledRedisCliPath(resources, 'darwin')).toBe(darwinBin);
        expect(bundledRedisCliPath(resources, 'win32')).toBe(
            path.join(resources, 'redis-cli', 'redis-cli.exe')
        );
    });

    it('sets REDIS_CLI_PATH when packaged and unset', () => {
        const env = {};
        applyBundledRedisCli({
            packaged: true,
            resourcesPath: resources,
            env,
            platform: 'darwin'
        });
        expect(env.REDIS_CLI_PATH).toBe(darwinBin);
    });

    it('keeps an explicit REDIS_CLI_PATH', () => {
        const env = { REDIS_CLI_PATH: '/custom/redis-cli' };
        applyBundledRedisCli({
            packaged: true,
            resourcesPath: resources,
            env,
            platform: 'darwin'
        });
        expect(env.REDIS_CLI_PATH).toBe('/custom/redis-cli');
    });

    it('does nothing when not packaged', () => {
        const env = {};
        applyBundledRedisCli({
            packaged: false,
            resourcesPath: resources,
            env,
            platform: 'darwin'
        });
        expect(env.REDIS_CLI_PATH).toBeUndefined();
    });
});
