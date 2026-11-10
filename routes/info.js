const express = require('express');
const router = express.Router();
const { execRedisCommand, parseRedisInfo } = require('../services/redis');

// Get Redis server info
router.get('/info', async (req, res) => {
    try {
        const env = req.query.env;
        const result = await execRedisCommand('INFO', env);

        // Parse INFO output into sections
        const sections = parseRedisInfo(result);

        res.json(sections);
    } catch (error) {
        console.error('Error fetching Redis info:', error);
        res.status(500).json(error);
    }
});

// Flush current database
router.post('/flush', async (req, res) => {
    try {
        const env = req.query.env;

        if (!req.body.confirm || req.body.confirm !== true) {
            return res
                .status(400)
                .json({ error: 'Confirmation required to flush database' });
        }

        const result = await execRedisCommand('FLUSHDB', env);
        res.json({
            result,
            message: 'Database flushed successfully',
            db: env
        });
    } catch (error) {
        console.error('Error flushing database:', error);
        res.status(500).json(error);
    }
});

// Execute arbitrary Redis command
router.post('/exec', async (req, res) => {
    const { command, env } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    try {
        const result = await execRedisCommand(command, env);
        res.json({ result });
    } catch (error) {
        res.status(500).json({
            error: error.message || 'Error executing Redis command'
        });
    }
});

module.exports = router;
