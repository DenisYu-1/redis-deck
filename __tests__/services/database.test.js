const {
    getAllConnections,
    getConnection,
    createConnection,
    updateConnection,
    deleteConnection,
    updateConnectionOrder,
    getConnectionConfig
} = require('../../services/database');

describe('Database Service', () => {
    const testConnectionId = 'test-db-conn-' + Date.now();

    afterAll(() => {
        try {
            deleteConnection(testConnectionId);
        } catch (error) {
            console.error('Cleanup warning:', error.message);
        }
    });

    describe('getAllConnections', () => {
        test('should return array of connections', () => {
            const connections = getAllConnections();

            expect(Array.isArray(connections)).toBe(true);
            expect(connections.length).toBeGreaterThan(0);
            expect(connections[0]).toHaveProperty('id');
            expect(connections[0]).toHaveProperty('host');
            expect(connections[0]).toHaveProperty('port');
        });

        test('should return connections ordered by order field', () => {
            const connections = getAllConnections();

            for (let i = 0; i < connections.length - 1; i++) {
                expect(connections[i].order).toBeLessThanOrEqual(
                    connections[i + 1].order
                );
            }
        });
    });

    describe('getConnection', () => {
        test('should return connection by id', () => {
            const connections = getAllConnections();
            const firstConnection = connections[0];

            const connection = getConnection(firstConnection.id);

            expect(connection).toBeDefined();
            expect(connection.id).toBe(firstConnection.id);
            expect(connection).toHaveProperty('host');
            expect(connection).toHaveProperty('port');
            expect(connection).toHaveProperty('password');
        });

        test('should return undefined for non-existent connection', () => {
            const connection = getConnection('non-existent-connection-id');

            expect(connection).toBeUndefined();
        });
    });

    describe('createConnection', () => {
        test('should create new connection with required fields', () => {
            const newConnection = {
                id: testConnectionId,
                host: '127.0.0.1',
                port: 6380
            };

            const success = createConnection(newConnection);

            expect(success).toBe(true);

            const connection = getConnection(testConnectionId);
            expect(connection).toBeDefined();
            expect(connection.id).toBe(testConnectionId);
            expect(connection.host).toBe('127.0.0.1');
            expect(connection.port).toBe(6380);
        });

        test('should create connection with optional fields', () => {
            const connectionId = testConnectionId + '-with-auth';

            const newConnection = {
                id: connectionId,
                host: 'redis.example.com',
                port: 6379,
                username: 'testuser',
                password: 'testpass',
                tls: true,
                cluster: true
            };

            const success = createConnection(newConnection);
            expect(success).toBe(true);

            const connection = getConnection(connectionId);
            expect(connection.username).toBe('testuser');
            expect(connection.password).toBe('testpass');
            expect(connection.tls).toBe(1);
            expect(connection.cluster).toBe(1);

            deleteConnection(connectionId);
        });

        test('should assign order to new connection', () => {
            const connectionId = testConnectionId + '-order-test';
            const newConnection = {
                id: connectionId,
                host: '127.0.0.1',
                port: 6381
            };

            const success = createConnection(newConnection);
            expect(success).toBe(true);

            const connection = getConnection(connectionId);
            expect(connection.order).toBeDefined();
            expect(typeof connection.order).toBe('number');

            deleteConnection(connectionId);
        });
    });

    describe('updateConnection', () => {
        test('should update existing connection', () => {
            const updateData = {
                host: 'updated-host.example.com',
                port: 6382,
                username: 'updateduser',
                password: 'updatedpass',
                tls: true,
                cluster: false
            };

            const success = updateConnection(testConnectionId, updateData);
            expect(success).toBe(true);

            const connection = getConnection(testConnectionId);
            expect(connection.host).toBe('updated-host.example.com');
            expect(connection.port).toBe(6382);
            expect(connection.username).toBe('updateduser');
            expect(connection.tls).toBe(1);
            expect(connection.cluster).toBe(0);
        });

        test('should return false for non-existent connection', () => {
            const success = updateConnection('non-existent-id', {
                host: 'localhost',
                port: 6379
            });

            expect(success).toBe(false);
        });
    });

    describe('updateConnectionOrder', () => {
        test('should update connection order', () => {
            const connections = getAllConnections();
            const connectionIds = connections.map((conn) => conn.id);

            const reversedIds = [...connectionIds].reverse();

            updateConnectionOrder(reversedIds);

            const updatedConnections = getAllConnections();
            expect(updatedConnections[0].id).toBe(reversedIds[0]);
            expect(updatedConnections[updatedConnections.length - 1].id).toBe(
                reversedIds[reversedIds.length - 1]
            );

            updateConnectionOrder(connectionIds);
        });
    });

    describe('deleteConnection', () => {
        test('should delete existing connection', () => {
            const connectionId = testConnectionId + '-to-delete';
            createConnection({
                id: connectionId,
                host: 'localhost',
                port: 6379
            });

            const success = deleteConnection(connectionId);
            expect(success).toBe(true);

            const connection = getConnection(connectionId);
            expect(connection).toBeUndefined();
        });

        test('should return false for non-existent connection', () => {
            const success = deleteConnection('non-existent-connection');
            expect(success).toBe(false);
        });
    });

    describe('getConnectionConfig', () => {
        test('should return config object for connection', () => {
            const config = getConnectionConfig(testConnectionId);

            expect(config).toBeDefined();
            expect(config).toHaveProperty('host');
            expect(config).toHaveProperty('port');
            expect(config.host).toBe('updated-host.example.com');
            expect(config.port).toBe(6382);
        });

        test('should throw error for non-existent connection', () => {
            expect(() => {
                getConnectionConfig('non-existent-connection');
            }).toThrow("Connection 'non-existent-connection' not found");
        });

        test('should convert tls and cluster flags to boolean', () => {
            const config = getConnectionConfig(testConnectionId);

            expect(typeof config.tls).toBe('boolean');
            expect(typeof config.cluster).toBe('boolean');
        });
    });
});
