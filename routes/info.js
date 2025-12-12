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

// Copy a key from one environment to another
router.post('/copy-key', async (req, res) => {
    const { sourceKey, targetKey, sourceEnv, targetEnv } = req.body;

    if (!sourceKey || !targetKey || !sourceEnv || !targetEnv) {
        return res.status(400).json({
            error: 'Source key, target key, source environment, and target environment are required'
        });
    }

    try {
        // First, get the key type
        const typeResult = await execRedisCommand(
            `TYPE ${sourceKey}`,
            sourceEnv
        );
        const keyType = typeResult.trim();

        if (keyType === 'none') {
            return res.status(404).json({
                error: `Key '${sourceKey}' not found in ${sourceEnv} environment`
            });
        }

        // Get TTL of the source key
        const ttlResult = await execRedisCommand(`TTL ${sourceKey}`, sourceEnv);
        const ttl = parseInt(ttlResult.trim(), 10);

        let copySuccessful = false;

        // Try to use DUMP and RESTORE for reliable copying (preserves all data types)
        try {
            const dumpResult = await execRedisCommand(
                `--raw DUMP ${sourceKey}`,
                sourceEnv
            );

            // Use RESTORE with REPLACE option and apply the TTL
            const ttlMs = ttl > 0 ? ttl * 1000 : 0;
            await execRedisCommand(
                `RESTORE ${targetKey} ${ttlMs} "${dumpResult.replace(/"/g, '\\"')}" REPLACE`,
                targetEnv
            );
            copySuccessful = true;
        } catch (dumpError) {
            // Fallback to type-specific copying for simple types
            if (keyType === 'string') {
                const value = await execRedisCommand(
                    `GET ${sourceKey}`,
                    sourceEnv
                );
                await execRedisCommand(
                    `SET ${targetKey} "${value.replace(/"/g, '\\"')}"`,
                    targetEnv
                );

                // Set TTL if it's positive
                if (ttl > 0) {
                    await execRedisCommand(
                        `EXPIRE ${targetKey} ${ttl}`,
                        targetEnv
                    );
                }
                copySuccessful = true;
            } else {
                throw new Error(
                    `Failed to copy key of type ${keyType}: ${dumpError.message}`
                );
            }
        }

        if (copySuccessful) {
            res.json({
                message: 'Key copied successfully',
                source: `${sourceEnv}:${sourceKey}`,
                target: `${targetEnv}:${targetKey}`
            });
        } else {
            throw new Error(`Failed to copy key of type ${keyType}`);
        }
    } catch (error) {
        res.status(500).json({
            error: error.message || 'Error copying key',
            details: error
        });
    }
});

module.exports = router;
