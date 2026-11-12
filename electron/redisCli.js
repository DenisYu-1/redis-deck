// Picks the redis-cli binary shipped inside the packaged app (extraResources).
const path = require('path');

function bundledRedisCliPath(resourcesPath, platform = process.platform) {
    const exe = platform === 'win32' ? 'redis-cli.exe' : 'redis-cli';
    return path.join(resourcesPath, 'redis-cli', exe);
}

// Packaged builds default to the bundled binary; an explicit REDIS_CLI_PATH wins.
function applyBundledRedisCli({
    packaged,
    resourcesPath,
    env = process.env,
    platform
}) {
    if (packaged && !env.REDIS_CLI_PATH) {
        env.REDIS_CLI_PATH = bundledRedisCliPath(resourcesPath, platform);
    }
}

module.exports = { bundledRedisCliPath, applyBundledRedisCli };
