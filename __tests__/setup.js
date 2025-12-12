const dotenv = require('dotenv');
const { db } = require('../services/database');
const { execRedisCommand } = require('../services/redis');

dotenv.config();

const TEST_CONNECTION_ID = 'test-connection';
const ORIGINAL_CONNECTIONS = [];

beforeAll(async () => {
    const connections = db.prepare('SELECT * FROM connections').all();
    ORIGINAL_CONNECTIONS.push(...connections);

    const hasTestConnection = connections.some(
        (conn) => conn.id === TEST_CONNECTION_ID
    );
    if (!hasTestConnection) {
        db.prepare(
            `
            INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
            TEST_CONNECTION_ID,
            process.env.REDIS_TEST_HOST || '127.0.0.1',
            parseInt(process.env.REDIS_TEST_PORT || '6379'),
            process.env.REDIS_TEST_USER || '',
            process.env.REDIS_TEST_PASSWORD || '',
            process.env.REDIS_TEST_TLS === 'true' ? 1 : 0,
            process.env.REDIS_TEST_CLUSTER === 'true' ? 1 : 0,
            999
        );
    }
});

afterAll(async () => {
    try {
        await execRedisCommand('FLUSHDB', TEST_CONNECTION_ID);
    } catch (error) {
        console.error('Warning: Could not flush test database:', error.message);
    }

    db.prepare('DELETE FROM connections WHERE id = ?').run(TEST_CONNECTION_ID);
});

global.TEST_CONNECTION_ID = TEST_CONNECTION_ID;
