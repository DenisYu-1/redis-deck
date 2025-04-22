const {
    execRedisCommand,
    parseRedisInfo,
    isClusterMode,
    getClusterNodes,
    scanClusterNodes,
    getKeyFromCluster
} = require('../../services/redis');
const {
    createTestKey,
    deleteTestKey,
    deleteTestKeys,
    keyExists
} = require('../helpers/testHelpers');

describe('Redis Service', () => {
    const testConnectionId = global.TEST_CONNECTION_ID;

    beforeEach(async () => {
        await deleteTestKeys('test:*', testConnectionId);
    });

    afterEach(async () => {
        await deleteTestKeys('test:*', testConnectionId);
    });

    describe('execRedisCommand', () => {
        test('should execute PING command', async () => {
            const result = await execRedisCommand('PING', testConnectionId);
            expect(result).toBe('PONG');
        });

        test('should execute SET command', async () => {
            const result = await execRedisCommand('SET "test:simple-key" "test-value"', testConnectionId);
            expect(result).toBe('OK');

            const exists = await keyExists('test:simple-key', testConnectionId);
            expect(exists).toBe(true);
        });

        test('should execute GET command', async () => {
            await createTestKey('test:get-key', 'get-value', testConnectionId);

            const result = await execRedisCommand('--raw GET "test:get-key"', testConnectionId);
            expect(result.trim()).toBe('get-value');
        });

        test('should execute DEL command', async () => {
            await createTestKey('test:del-key', 'del-value', testConnectionId);

            const result = await execRedisCommand('DEL "test:del-key"', testConnectionId);
            expect(parseInt(result.trim())).toBe(1);

            const exists = await keyExists('test:del-key', testConnectionId);
            expect(exists).toBe(false);
        });

        test('should execute EXISTS command', async () => {
            await createTestKey('test:exists-key', 'exists-value', testConnectionId);

            const result = await execRedisCommand('EXISTS "test:exists-key"', testConnectionId);
            expect(parseInt(result.trim())).toBe(1);
        });

        test('should execute TYPE command', async () => {
            await createTestKey('test:type-key', 'type-value', testConnectionId);

            const result = await execRedisCommand('TYPE "test:type-key"', testConnectionId);
            expect(result.trim()).toBe('string');
        });

        test('should execute TTL command', async () => {
            await createTestKey('test:ttl-key', 'ttl-value', testConnectionId, 100);

            const result = await execRedisCommand('TTL "test:ttl-key"', testConnectionId);
            const ttl = parseInt(result.trim());
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(100);
        });

        test('should execute EXPIRE command', async () => {
            await createTestKey('test:expire-key', 'expire-value', testConnectionId);

            const result = await execRedisCommand('EXPIRE "test:expire-key" 60', testConnectionId);
            expect(parseInt(result.trim())).toBe(1);

            const ttl = await execRedisCommand('TTL "test:expire-key"', testConnectionId);
            expect(parseInt(ttl.trim())).toBeGreaterThan(0);
        });

        test('should execute HSET and HGET commands', async () => {
            await execRedisCommand('HSET "test:hash-key" "field1" "value1"', testConnectionId);
            const result = await execRedisCommand('--raw HGET "test:hash-key" "field1"', testConnectionId);
            expect(result.trim()).toBe('value1');
        });

        test('should execute HGETALL command', async () => {
            await execRedisCommand('HSET "test:hash-all" "field1" "value1"', testConnectionId);
            await execRedisCommand('HSET "test:hash-all" "field2" "value2"', testConnectionId);

            const result = await execRedisCommand('HGETALL "test:hash-all"', testConnectionId);
            expect(result).toContain('field1');
            expect(result).toContain('value1');
            expect(result).toContain('field2');
            expect(result).toContain('value2');
        });

        test('should execute DBSIZE command', async () => {
            await createTestKey('test:dbsize-key', 'value', testConnectionId);

            const result = await execRedisCommand('DBSIZE', testConnectionId);
            const count = parseInt(result.trim());
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should handle connection errors gracefully', async () => {
            try {
                await execRedisCommand('PING', 'non-existent-connection');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Connection \'non-existent-connection\' not found');
            }
        });
    });

    describe('parseRedisInfo', () => {
        test('should parse INFO command output into sections', async () => {
            const infoString = await execRedisCommand('INFO', testConnectionId);
            const sections = parseRedisInfo(infoString);

            expect(sections).toBeDefined();
            expect(typeof sections).toBe('object');
            expect(sections).toHaveProperty('server');

            if (sections.server) {
                expect(sections.server).toHaveProperty('redis_version');
            }
        });

        test('should parse server section', () => {
            const infoString = `# Server
redis_version:7.0.0
redis_mode:standalone
os:Linux

# Clients
connected_clients:10`;

            const sections = parseRedisInfo(infoString);

            expect(sections.server).toBeDefined();
            expect(sections.server.redis_version).toBe('7.0.0');
            expect(sections.server.redis_mode).toBe('standalone');
            expect(sections.server.os).toBe('Linux');
            expect(sections.clients).toBeDefined();
            expect(sections.clients.connected_clients).toBe('10');
        });

        test('should handle empty lines and comments', () => {
            const infoString = `# Server
redis_version:6.2.0

# Stats
total_commands_processed:1000`;

            const sections = parseRedisInfo(infoString);

            expect(sections.server.redis_version).toBe('6.2.0');
            expect(sections.stats.total_commands_processed).toBe('1000');
        });
    });

    describe('isClusterMode', () => {
        test('should check if connection is in cluster mode', async () => {
            const result = await isClusterMode(testConnectionId);
            expect(typeof result).toBe('boolean');
        });

        test('should return false for standalone mode', async () => {
            const result = await isClusterMode(testConnectionId);
            expect(result).toBe(false);
        });
    });

    describe('getClusterNodes', () => {
        test('should return array of nodes', async () => {
            const nodes = await getClusterNodes(testConnectionId);

            expect(Array.isArray(nodes)).toBe(true);
            expect(nodes.length).toBeGreaterThan(0);
        });

        test('should return single node for standalone mode', async () => {
            const nodes = await getClusterNodes(testConnectionId);

            expect(nodes.length).toBeGreaterThanOrEqual(1);
            expect(nodes[0]).toHaveProperty('id');
            expect(nodes[0]).toHaveProperty('host');
            expect(nodes[0]).toHaveProperty('port');
        });

        test('node should have required properties', async () => {
            const nodes = await getClusterNodes(testConnectionId);
            const node = nodes[0];

            expect(node).toHaveProperty('id');
            expect(node).toHaveProperty('host');
            expect(node).toHaveProperty('port');
            expect(typeof node.host).toBe('string');
            expect(typeof node.port).toBe('number');
        });
    });

    describe('scanClusterNodes', () => {
        test('should scan keys with pattern', async () => {
            await createTestKey('test:scan:key1', 'value1', testConnectionId);
            await createTestKey('test:scan:key2', 'value2', testConnectionId);
            await createTestKey('test:scan:key3', 'value3', testConnectionId);

            const result = await scanClusterNodes('test:scan:*', ['0'], 100, testConnectionId);

            expect(result).toHaveProperty('keys');
            expect(result).toHaveProperty('cursors');
            expect(result).toHaveProperty('hasMore');
            expect(Array.isArray(result.keys)).toBe(true);
            expect(result.keys.length).toBeGreaterThanOrEqual(3);
        });

        test('should return empty array for non-matching pattern', async () => {
            const result = await scanClusterNodes('non:existent:pattern:*', ['0'], 100, testConnectionId);

            expect(result.keys).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        test('should handle pagination with cursors', async () => {
            for (let i = 0; i < 10; i++) {
                await createTestKey(`test:pagination:key${i}`, `value${i}`, testConnectionId);
            }

            const result = await scanClusterNodes('test:pagination:*', ['0'], 10, testConnectionId);

            expect(Array.isArray(result.cursors)).toBe(true);
            expect(typeof result.hasMore).toBe('boolean');
        });

        test('should scan all keys with wildcard', async () => {
            await createTestKey('test:wildcard:a', 'value', testConnectionId);
            await createTestKey('test:wildcard:b', 'value', testConnectionId);

            const result = await scanClusterNodes('*', ['0'], 1000, testConnectionId);

            expect(result.keys.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('getKeyFromCluster', () => {
        test('should get key value from cluster', async () => {
            await createTestKey('test:cluster-get', 'cluster-value', testConnectionId);

            const result = await getKeyFromCluster('test:cluster-get', testConnectionId);

            expect(result).toHaveProperty('key');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('value');
            expect(result).toHaveProperty('ttl');
            expect(result.key).toBe('test:cluster-get');
            expect(result.type).toBe('string');
            expect(result.value.trim()).toBe('cluster-value');
        });

        test('should get key with TTL', async () => {
            await createTestKey('test:cluster-ttl', 'ttl-value', testConnectionId, 120);

            const result = await getKeyFromCluster('test:cluster-ttl', testConnectionId);

            expect(result.ttl).toBeGreaterThan(0);
            expect(result.ttl).toBeLessThanOrEqual(120);
        });

        test('should get hash type key', async () => {
            await execRedisCommand('HSET "test:cluster-hash" "field1" "value1"', testConnectionId);
            await execRedisCommand('HSET "test:cluster-hash" "field2" "value2"', testConnectionId);

            const result = await getKeyFromCluster('test:cluster-hash', testConnectionId);

            expect(result.type).toBe('hash');
            expect(result.value).toBeDefined();
        });

        test('should throw error for non-existent key', async () => {
            await expect(
                getKeyFromCluster('test:non-existent-key', testConnectionId)
            ).rejects.toThrow('Key not found');
        });

        test('should handle keys with special characters', async () => {
            const specialKey = 'test:special:key:with:colons';
            await createTestKey(specialKey, 'special-value', testConnectionId);

            const result = await getKeyFromCluster(specialKey, testConnectionId);

            expect(result.key).toBe(specialKey);
            expect(result.value.trim()).toBe('special-value');
        });
    });

    describe('Real Redis Integration', () => {
        test('should connect to Redis server', async () => {
            const result = await execRedisCommand('PING', testConnectionId);
            expect(result).toBe('PONG');
        });

        test('should perform complete key lifecycle', async () => {
            const key = 'test:lifecycle';
            const value = 'lifecycle-value';

            await createTestKey(key, value, testConnectionId);

            const exists = await keyExists(key, testConnectionId);
            expect(exists).toBe(true);

            const retrieved = await getKeyFromCluster(key, testConnectionId);
            expect(retrieved.value.trim()).toBe(value);

            await deleteTestKey(key, testConnectionId);

            const existsAfterDelete = await keyExists(key, testConnectionId);
            expect(existsAfterDelete).toBe(false);
        });

        test('should handle concurrent operations', async () => {
            const operations = [];
            for (let i = 0; i < 5; i++) {
                operations.push(
                    createTestKey(`test:concurrent:${i}`, `value${i}`, testConnectionId)
                );
            }

            await Promise.all(operations);

            for (let i = 0; i < 5; i++) {
                const exists = await keyExists(`test:concurrent:${i}`, testConnectionId);
                expect(exists).toBe(true);
            }
        });
    });
});

