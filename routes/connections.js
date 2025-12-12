const express = require('express');
const router = express.Router();
const {
    getAllConnections,
    getConnection,
    createConnection,
    updateConnection,
    deleteConnection,
    updateConnectionOrder
} = require('../services/database');
const { execRedisCommand } = require('../services/redis');

// Get all connections
router.get('/connections', (req, res) => {
    try {
        const connections = getAllConnections();
        res.json({ connections });
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
});

// Export all connections
router.get('/connections/export', (req, res) => {
    try {
        const allConnections = getAllConnections();
        const connectionsWithPasswords = allConnections.map((conn) => {
            const fullConnection = getConnection(conn.id);
            return {
                id: fullConnection.id,
                host: fullConnection.host,
                port: fullConnection.port,
                username: fullConnection.username || '',
                password: fullConnection.password || '',
                tls: fullConnection.tls === 1,
                cluster: fullConnection.cluster === 1,
                order: fullConnection.order || 0
            };
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=redis-connections.json'
        );
        res.json({ connections: connectionsWithPasswords });
    } catch (error) {
        console.error('Error exporting connections:', error);
        res.status(500).json({ error: 'Failed to export connections' });
    }
});

// Get a specific connection
router.get('/connections/:id', (req, res) => {
    try {
        const id = req.params.id;
        const connection = getConnection(id);

        if (!connection) {
            return res
                .status(404)
                .json({ error: `Connection '${id}' not found` });
        }

        // Don't send the password back to the client
        delete connection.password;

        res.json({ connection });
    } catch (error) {
        console.error(`Error fetching connection '${req.params.id}':`, error);
        res.status(500).json({ error: 'Failed to fetch connection' });
    }
});

// Create a new connection
router.post('/connections', (req, res) => {
    try {
        const connection = req.body;

        // Validate required fields
        if (!connection.id || !connection.host || !connection.port) {
            return res
                .status(400)
                .json({ error: 'Connection ID, host and port are required' });
        }

        // Check if connection ID already exists
        const existing = getConnection(connection.id);
        if (existing) {
            return res.status(409).json({
                error: `Connection with ID '${connection.id}' already exists`
            });
        }

        const success = createConnection(connection);

        if (success) {
            // Don't send the password back to the client
            delete connection.password;
            res.status(201).json({
                message: 'Connection created successfully',
                connection
            });
        } else {
            res.status(500).json({ error: 'Failed to create connection' });
        }
    } catch (error) {
        console.error('Error creating connection:', error);
        res.status(500).json({ error: 'Failed to create connection' });
    }
});

// Update connection order (must be before /connections/:id route)
router.put('/connections/order', (req, res) => {
    try {
        const { connectionIds } = req.body;

        if (!Array.isArray(connectionIds)) {
            return res
                .status(400)
                .json({ error: 'connectionIds must be an array' });
        }

        // Validate that all IDs exist
        const allConnections = getAllConnections();
        const allIds = allConnections.map((conn) => conn.id);

        for (const id of connectionIds) {
            if (!allIds.includes(id)) {
                return res
                    .status(400)
                    .json({ error: `Connection '${id}' not found` });
            }
        }

        // Validate that all connections are included
        if (connectionIds.length !== allIds.length) {
            return res.status(400).json({
                error: 'All connections must be included in the order'
            });
        }

        updateConnectionOrder(connectionIds);

        res.json({ message: 'Connection order updated successfully' });
    } catch (error) {
        console.error('Error updating connection order:', error);
        res.status(500).json({ error: 'Failed to update connection order' });
    }
});

// Update an existing connection
router.put('/connections/:id', (req, res) => {
    try {
        const id = req.params.id;
        const connection = req.body;

        // Validate required fields
        if (!connection.host || !connection.port) {
            return res
                .status(400)
                .json({ error: 'Connection host and port are required' });
        }

        // Check if connection exists
        const existing = getConnection(id);
        if (!existing) {
            return res
                .status(404)
                .json({ error: `Connection '${id}' not found` });
        }

        // If password is not provided, keep the existing one
        if (!connection.password) {
            connection.password = existing.password;
        }

        const success = updateConnection(id, connection);

        if (success) {
            // Don't send the password back to the client
            delete connection.password;
            res.json({
                message: 'Connection updated successfully',
                connection: { id, ...connection }
            });
        } else {
            res.status(500).json({ error: 'Failed to update connection' });
        }
    } catch (error) {
        console.error(`Error updating connection '${req.params.id}':`, error);
        res.status(500).json({ error: 'Failed to update connection' });
    }
});

// Delete a connection
router.delete('/connections/:id', (req, res) => {
    try {
        const id = req.params.id;

        // Check if connection exists
        const existing = getConnection(id);
        if (!existing) {
            return res
                .status(404)
                .json({ error: `Connection '${id}' not found` });
        }

        const success = deleteConnection(id);

        if (success) {
            res.json({ message: `Connection '${id}' deleted successfully` });
        } else {
            res.status(500).json({ error: 'Failed to delete connection' });
        }
    } catch (error) {
        console.error(`Error deleting connection '${req.params.id}':`, error);
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

// Test a connection
router.post('/connections/:id/test', async (req, res) => {
    try {
        const id = req.params.id;

        // Check if connection exists
        const connection = getConnection(id);
        if (!connection) {
            return res
                .status(404)
                .json({ error: `Connection '${id}' not found` });
        }

        // Try to execute PING command
        const result = await execRedisCommand('PING', id);

        res.json({
            success: result === 'PONG',
            message:
                result === 'PONG'
                    ? 'Connection successful'
                    : 'Connection failed',
            result
        });
    } catch (error) {
        console.error(`Error testing connection '${req.params.id}':`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to test connection'
        });
    }
});

// Import connections
router.post('/connections/import', (req, res) => {
    try {
        const { connections } = req.body;

        if (!Array.isArray(connections)) {
            return res.status(400).json({
                error: 'Invalid format: connections must be an array'
            });
        }

        const allConnections = getAllConnections();
        const existingIds = new Set(allConnections.map((conn) => conn.id));
        const existingOrders = new Set(
            allConnections.map((conn) => conn.order)
        );

        const results = {
            imported: [],
            skipped: [],
            errors: []
        };

        connections.forEach((conn) => {
            try {
                if (!conn.id || !conn.host || conn.port === undefined) {
                    results.errors.push({
                        connection: conn,
                        reason: 'Missing required fields (id, host, port)'
                    });
                    return;
                }

                let finalId = conn.id;
                let copyNumber = 1;

                while (existingIds.has(finalId)) {
                    finalId = `${conn.id}_copy${copyNumber}`;
                    copyNumber++;
                }

                let finalOrder = conn.order !== undefined ? conn.order : 0;
                while (existingOrders.has(finalOrder)) {
                    finalOrder++;
                }

                const newConnection = {
                    id: finalId,
                    host: conn.host,
                    port: conn.port,
                    username: conn.username || '',
                    password: conn.password || '',
                    tls: conn.tls ? 1 : 0,
                    cluster: conn.cluster ? 1 : 0,
                    order: finalOrder
                };

                const success = createConnection(newConnection);

                if (success) {
                    existingIds.add(finalId);
                    existingOrders.add(finalOrder);
                    results.imported.push({
                        originalId: conn.id,
                        importedAs: finalId,
                        order: finalOrder
                    });
                } else {
                    results.errors.push({
                        connection: conn,
                        reason: 'Failed to create connection'
                    });
                }
            } catch (error) {
                results.errors.push({
                    connection: conn,
                    reason: error.message
                });
            }
        });

        res.json({
            message: `Import completed: ${results.imported.length} imported, ${results.errors.length} errors`,
            results
        });
    } catch (error) {
        console.error('Error importing connections:', error);
        res.status(500).json({ error: 'Failed to import connections' });
    }
});

module.exports = router;
