const { execRedisCommand } = require('../../services/redis');

async function createTestKey(key, value, connectionId = global.TEST_CONNECTION_ID, ttl = null) {
    const escapedValue = String(value).replace(/"/g, '\\"').replace(/(\r\n|\n|\r)/g, '\\n');
    let command = `SET "${key}" "${escapedValue}"`;

    if (ttl) {
        command += ` EX ${ttl}`;
    }

    await execRedisCommand(command, connectionId);
}

async function createTestHash(key, fields, connectionId = global.TEST_CONNECTION_ID) {
    for (const [field, value] of Object.entries(fields)) {
        const escapedValue = String(value).replace(/"/g, '\\"');
        await execRedisCommand(`HSET "${key}" "${field}" "${escapedValue}"`, connectionId);
    }
}

async function createTestZSet(key, members, connectionId = global.TEST_CONNECTION_ID) {
    let command = `ZADD "${key}"`;
    for (const { score, value } of members) {
        const escapedValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        command += ` ${score} "${escapedValue}"`;
    }
    await execRedisCommand(command, connectionId);
}

async function deleteTestKey(key, connectionId = global.TEST_CONNECTION_ID) {
    try {
        await execRedisCommand(`DEL "${key}"`, connectionId);
    } catch (error) {
        console.error(`Warning: Could not delete test key ${key}:`, error.message);
    }
}

async function deleteTestKeys(pattern, connectionId = global.TEST_CONNECTION_ID) {
    try {
        const { scanClusterNodes } = require('../../services/redis');
        const keys = [];
        let cursors = ['0'];
        let hasMore = true;

        while (hasMore) {
            const result = await scanClusterNodes(pattern, cursors, 10000, connectionId);
            keys.push(...result.keys);
            cursors = result.cursors;
            hasMore = result.hasMore;
        }

        for (const key of keys) {
            await deleteTestKey(key, connectionId);
        }
    } catch (error) {
        console.error(`Warning: Could not delete test keys with pattern ${pattern}:`, error.message);
    }
}

async function keyExists(key, connectionId = global.TEST_CONNECTION_ID) {
    try {
        const result = await execRedisCommand(`EXISTS "${key}"`, connectionId);
        return parseInt(result.trim()) === 1;
    } catch {
        return false;
    }
}

async function getKeyValue(key, connectionId = global.TEST_CONNECTION_ID) {
    try {
        const result = await execRedisCommand(`--raw GET "${key}"`, connectionId);
        return result;
    } catch {
        return null;
    }
}

async function getKeyTTL(key, connectionId = global.TEST_CONNECTION_ID) {
    try {
        const result = await execRedisCommand(`TTL "${key}"`, connectionId);
        return parseInt(result.trim());
    } catch {
        return -2;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    createTestKey,
    createTestHash,
    createTestZSet,
    deleteTestKey,
    deleteTestKeys,
    keyExists,
    getKeyValue,
    getKeyTTL,
    sleep
};

