const request = require('supertest');
const { createApp } = require('../../config/app');
const { deleteConnection, getConnection } = require('../../services/database');

describe('Connection Routes', () => {
    const app = createApp();
    const testConnectionId = 'test-conn-route-' + Date.now();

    afterAll(() => {
        try {
            deleteConnection(testConnectionId);
        } catch (error) {
            console.error('Cleanup warning:', error.message);
        }
    });

    describe('GET /api/connections', () => {
        test('should return list of connections', async () => {
            const response = await request(app)
                .get('/api/connections')
                .expect(200);

            expect(response.body).toHaveProperty('connections');
            expect(Array.isArray(response.body.connections)).toBe(true);
            expect(response.body.connections.length).toBeGreaterThan(0);
        });

        test('should not include password in response', async () => {
            const response = await request(app)
                .get('/api/connections')
                .expect(200);

            response.body.connections.forEach((conn) => {
                expect(conn).not.toHaveProperty('password');
            });
        });

        test('should return connections with required fields', async () => {
            const response = await request(app)
                .get('/api/connections')
                .expect(200);

            const conn = response.body.connections[0];
            expect(conn).toHaveProperty('id');
            expect(conn).toHaveProperty('host');
            expect(conn).toHaveProperty('port');
        });
    });

    describe('GET /api/connections/:id', () => {
        test('should return specific connection', async () => {
            const response = await request(app)
                .get('/api/connections')
                .expect(200);

            const firstId = response.body.connections[0].id;

            const connResponse = await request(app)
                .get(`/api/connections/${firstId}`)
                .expect(200);

            expect(connResponse.body).toHaveProperty('connection');
            expect(connResponse.body.connection.id).toBe(firstId);
        });

        test('should not include password in response', async () => {
            const response = await request(app)
                .get('/api/connections')
                .expect(200);

            const firstId = response.body.connections[0].id;

            const connResponse = await request(app)
                .get(`/api/connections/${firstId}`)
                .expect(200);

            expect(connResponse.body.connection).not.toHaveProperty('password');
        });

        test('should return 404 for non-existent connection', async () => {
            const response = await request(app)
                .get('/api/connections/non-existent-connection')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/connections', () => {
        test('should create new connection', async () => {
            const newConnection = {
                id: testConnectionId,
                host: '127.0.0.1',
                port: 6380,
                username: 'testuser',
                password: 'testpass',
                tls: false,
                cluster: false
            };

            const response = await request(app)
                .post('/api/connections')
                .send(newConnection)
                .expect(201);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('connection');
            expect(response.body.connection.id).toBe(testConnectionId);
        });

        test('should return 400 for missing required fields', async () => {
            const invalidConnection = {
                id: 'test-invalid'
            };

            const response = await request(app)
                .post('/api/connections')
                .send(invalidConnection)
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 409 for duplicate connection id', async () => {
            const duplicateConnection = {
                id: testConnectionId,
                host: '127.0.0.1',
                port: 6381
            };

            const response = await request(app)
                .post('/api/connections')
                .send(duplicateConnection)
                .expect(409);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PUT /api/connections/:id', () => {
        test('should update existing connection', async () => {
            const updateData = {
                host: 'updated.example.com',
                port: 6382,
                username: 'updateduser',
                password: 'updatedpass',
                tls: true,
                cluster: false
            };

            const response = await request(app)
                .put(`/api/connections/${testConnectionId}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.connection.id).toBe(testConnectionId);

            const connection = getConnection(testConnectionId);
            expect(connection.host).toBe('updated.example.com');
            expect(connection.port).toBe(6382);
        });

        test('should return 404 for non-existent connection', async () => {
            const response = await request(app)
                .put('/api/connections/non-existent-id')
                .send({ host: 'localhost', port: 6379 })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 for missing required fields', async () => {
            const response = await request(app)
                .put(`/api/connections/${testConnectionId}`)
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PUT /api/connections/order', () => {
        test('should update connection order', async () => {
            const connectionsResponse = await request(app)
                .get('/api/connections')
                .expect(200);

            const connectionIds = connectionsResponse.body.connections.map(
                (c) => c.id
            );

            const response = await request(app)
                .put('/api/connections/order')
                .send({ connectionIds })
                .expect(200);

            expect(response.body).toHaveProperty('message');
        });

        test('should return 400 for invalid input', async () => {
            const response = await request(app)
                .put('/api/connections/order')
                .send({ connectionIds: 'not-an-array' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should return 400 for non-existent connection id', async () => {
            const response = await request(app)
                .put('/api/connections/order')
                .send({ connectionIds: ['non-existent-id'] })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('DELETE /api/connections/:id', () => {
        test('should delete connection', async () => {
            const tempId = testConnectionId + '-to-delete';

            await request(app)
                .post('/api/connections')
                .send({
                    id: tempId,
                    host: '127.0.0.1',
                    port: 6379
                })
                .expect(201);

            const response = await request(app)
                .delete(`/api/connections/${tempId}`)
                .expect(200);

            expect(response.body).toHaveProperty('message');

            const connection = getConnection(tempId);
            expect(connection).toBeUndefined();
        });

        test('should return 404 for non-existent connection', async () => {
            const response = await request(app)
                .delete('/api/connections/non-existent-connection')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/connections/:id/test', () => {
        test('should test connection successfully', async () => {
            const response = await request(app)
                .post(`/api/connections/${global.TEST_CONNECTION_ID}/test`)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('result');
            expect(response.body.success).toBe(true);
            expect(response.body.result).toBe('PONG');
        });

        test('should return 404 for non-existent connection', async () => {
            const response = await request(app)
                .post('/api/connections/non-existent-connection/test')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/connections/export', () => {
        test('should export all connections as JSON', async () => {
            const response = await request(app)
                .get('/api/connections/export')
                .expect(200);

            expect(response.body).toHaveProperty('connections');
            expect(Array.isArray(response.body.connections)).toBe(true);
            expect(response.body.connections.length).toBeGreaterThan(0);
        });

        test('should include passwords in export', async () => {
            const response = await request(app)
                .get('/api/connections/export')
                .expect(200);

            const conn = response.body.connections[0];
            expect(conn).toHaveProperty('id');
            expect(conn).toHaveProperty('host');
            expect(conn).toHaveProperty('port');
            expect(conn).toHaveProperty('password');
            expect(conn).toHaveProperty('username');
            expect(conn).toHaveProperty('tls');
            expect(conn).toHaveProperty('cluster');
            expect(conn).toHaveProperty('order');
        });

        test('should export connections with boolean values for tls and cluster', async () => {
            const response = await request(app)
                .get('/api/connections/export')
                .expect(200);

            response.body.connections.forEach((conn) => {
                expect(typeof conn.tls).toBe('boolean');
                expect(typeof conn.cluster).toBe('boolean');
            });
        });
    });

    describe('POST /api/connections/import', () => {
        const importTestId1 = 'import-test-' + Date.now();
        const importTestId2 = 'import-test-' + Date.now() + '-2';

        afterAll(() => {
            try {
                deleteConnection(importTestId1);
                deleteConnection(importTestId2);
                deleteConnection(`${importTestId1}_copy1`);
            } catch (error) {
                console.error('Cleanup warning:', error.message);
            }
        });

        test('should import connections from JSON', async () => {
            const importData = {
                connections: [
                    {
                        id: importTestId1,
                        host: 'import-test.example.com',
                        port: 6379,
                        username: 'importuser',
                        password: 'importpass',
                        tls: false,
                        cluster: false,
                        order: 999
                    }
                ]
            };

            const response = await request(app)
                .post('/api/connections/import')
                .send(importData)
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('results');
            expect(response.body.results.imported.length).toBe(1);
            expect(response.body.results.errors.length).toBe(0);

            const connection = getConnection(importTestId1);
            expect(connection).toBeDefined();
            expect(connection.host).toBe('import-test.example.com');
        });

        test('should handle duplicate connection IDs by adding suffix', async () => {
            const importData = {
                connections: [
                    {
                        id: importTestId1,
                        host: 'duplicate-test.example.com',
                        port: 6380,
                        username: '',
                        password: '',
                        tls: false,
                        cluster: false,
                        order: 1000
                    }
                ]
            };

            const response = await request(app)
                .post('/api/connections/import')
                .send(importData)
                .expect(200);

            expect(response.body.results.imported.length).toBe(1);
            expect(response.body.results.imported[0].originalId).toBe(
                importTestId1
            );
            expect(response.body.results.imported[0].importedAs).toBe(
                `${importTestId1}_copy1`
            );

            const connection = getConnection(`${importTestId1}_copy1`);
            expect(connection).toBeDefined();
            expect(connection.host).toBe('duplicate-test.example.com');
        });

        test('should handle duplicate orders by incrementing', async () => {
            const importData = {
                connections: [
                    {
                        id: importTestId2,
                        host: 'order-test.example.com',
                        port: 6381,
                        username: '',
                        password: '',
                        tls: false,
                        cluster: false,
                        order: 0
                    }
                ]
            };

            const response = await request(app)
                .post('/api/connections/import')
                .send(importData)
                .expect(200);

            expect(response.body.results.imported.length).toBe(1);

            const connection = getConnection(importTestId2);
            expect(connection).toBeDefined();
            expect(connection.order).toBeGreaterThanOrEqual(0);
        });

        test('should return 400 for invalid format', async () => {
            const response = await request(app)
                .post('/api/connections/import')
                .send({ connections: 'not-an-array' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle connections with missing required fields', async () => {
            const importData = {
                connections: [
                    {
                        id: 'invalid-connection'
                    }
                ]
            };

            const response = await request(app)
                .post('/api/connections/import')
                .send(importData)
                .expect(200);

            expect(response.body.results.errors.length).toBe(1);
            expect(response.body.results.imported.length).toBe(0);
        });

        test('should import multiple connections at once', async () => {
            const multiImportId1 = 'multi-import-1-' + Date.now();
            const multiImportId2 = 'multi-import-2-' + Date.now();

            const importData = {
                connections: [
                    {
                        id: multiImportId1,
                        host: 'multi1.example.com',
                        port: 6379,
                        username: '',
                        password: '',
                        tls: false,
                        cluster: false,
                        order: 2000
                    },
                    {
                        id: multiImportId2,
                        host: 'multi2.example.com',
                        port: 6380,
                        username: '',
                        password: '',
                        tls: true,
                        cluster: true,
                        order: 2001
                    }
                ]
            };

            const response = await request(app)
                .post('/api/connections/import')
                .send(importData)
                .expect(200);

            expect(response.body.results.imported.length).toBe(2);
            expect(response.body.results.errors.length).toBe(0);

            const conn1 = getConnection(multiImportId1);
            const conn2 = getConnection(multiImportId2);

            expect(conn1).toBeDefined();
            expect(conn2).toBeDefined();
            expect(conn1.host).toBe('multi1.example.com');
            expect(conn2.host).toBe('multi2.example.com');
            expect(conn2.tls).toBe(1);
            expect(conn2.cluster).toBe(1);

            deleteConnection(multiImportId1);
            deleteConnection(multiImportId2);
        });
    });
});
