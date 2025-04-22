const express = require('express');
const router = express.Router();
const { execRedisCommand } = require('../services/redis');

// This route will handle custom Redis command sequences
// Placeholder for the future implementation that will accept
// a set of commands to execute in sequence
router.post('/execute', async (req, res) => {
    try {
        const { commands, env } = req.body;

        if (!commands || !Array.isArray(commands) || commands.length === 0) {
            return res.status(400).json({ error: 'Valid commands array is required' });
        }

        if (!env) {
            return res.status(400).json({ error: 'Environment (env) parameter is required' });
        }

        const results = [];

        // Execute each command in sequence
        for (const command of commands) {
            if (!command || typeof command !== 'string') {
                results.push({ error: 'Invalid command format', command });
                continue;
            }

            try {
                const result = await execRedisCommand(command, env);
                results.push({ success: true, result, command });
            } catch (cmdError) {
                results.push({
                    success: false,
                    error: cmdError.message || 'Command execution failed',
                    command
                });

                // Don't break on errors, continue with next command
            }
        }

        res.json({
            success: results.every(r => r.success),
            results
        });
    } catch (error) {
        console.error('Error executing custom command sequence:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error executing command sequence'
        });
    }
});

module.exports = router;
