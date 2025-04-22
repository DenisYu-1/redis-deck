const express = require('express');
const router = express.Router();
const { getAllConnections, getConnection } = require('../services/database');

// Get available environments (connections)
router.get('/environments', (req, res) => {
    try {
        const connections = getAllConnections();

        const envList = connections.map(conn => ({
            id: conn.id,
            name: conn.name,
            host: conn.host,
            port: conn.port,
            tls: conn.tls === 1
        }));

        res.json({ environments: envList });
    } catch (error) {
        console.error('Error fetching environments:', error);
        res.status(500).json({ error: 'Failed to fetch environments' });
    }
});

// Check environment health/connection
router.get('/health', (req, res) => {
    try {
        const env = req.query.env;
        const connection = getConnection(env);

        if (!connection) {
            return res.status(404).json({ error: `Environment '${env}' not found` });
        }

        res.json({
            status: 'ok',
            environment: env,
            host: connection.host,
            port: connection.port,
            tls: connection.tls === 1
        });
    } catch (error) {
        console.error(`Error checking health for environment '${req.query.env}':`, error);
        res.status(500).json({ error: 'Failed to check environment health' });
    }
});

module.exports = router;
