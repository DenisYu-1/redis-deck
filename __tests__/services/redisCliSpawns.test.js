const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { execRedisCommand } = require('../../services/redis');

test('every redis-cli process the backend spawns is counted', async () => {
    const spawns = countRedisCliSpawns();
    try {
        await execRedisCommand('PING', global.TEST_CONNECTION_ID);
        await execRedisCommand('PING', global.TEST_CONNECTION_ID);
        expect(spawns.count).toBe(2);
        spawns.reset();
        expect(spawns.count).toBe(0);
    } finally {
        spawns.restore();
    }
});
