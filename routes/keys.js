const express = require('express');
const router = express.Router();
const { execRedisCommand, scanClusterNodes, getKeyFromCluster } = require('../services/redis');

// Search keys by pattern with pagination using SCAN
router.get('/keys', async (req, res) => {
    try {
        const env = req.query.env;
        const pattern = req.query.pattern || '*';
        const count = parseInt(req.query.count) || 50;

        // Get cursors array from frontend
        let cursors = ['0'];

        try {
            if (req.query.cursors) {
                // Parse the JSON array of cursors
                const cursorsArray = JSON.parse(req.query.cursors);
                cursors = cursorsArray.length > 0 ? cursorsArray : ['0'];
            }
        } catch (e) {
            console.error('Invalid cursors format, using default:', e);
        }

        let keys = [];
        let nextCursors = cursors;
        let iterations = 0;
        let hasMore = false;
        const MAX_ITERATIONS = 1000; // Limit auto-pagination to prevent excessive scanning

        // Auto-pagination loop - continue until we find at least one key or exhaust pagination
        do {
            const result = await scanClusterNodes(pattern, nextCursors, count, env);

            // Add keys to results
            keys = keys.concat(result.keys);

            // Update cursors for next iteration
            nextCursors = result.cursors;
            hasMore = result.hasMore;

            iterations++;

            // Continue if we found no keys, there are more available, and we haven't hit max iterations
        } while (keys.length === 0 && hasMore && iterations < MAX_ITERATIONS);

        res.json({
            keys,
            cursors: nextCursors, // Array of cursors (one for each node)
            hasMore,
            total: keys.length + (hasMore ? '?' : 0)
        });
    } catch (error) {
        console.error('Error scanning keys:', error);
        res.status(500).json(error);
    }
});

// Get all keys without pagination (for operations that need all keys)
router.get('/allkeys', async (req, res) => {
    try {
        const env = req.query.env;
        const pattern = req.query.pattern || '*';

        const keys = [];
        let cursors = ['0'];
        let hasMore = true;

        // Keep scanning until we get all keys
        while (hasMore) {
            const result = await scanClusterNodes(pattern, cursors, 10000, env);
            keys.push(...result.keys);
            cursors = result.cursors;
            hasMore = result.hasMore;
        }

        res.json({ keys });
    } catch (error) {
        res.status(500).json(error);
    }
});

// Get value for a key
router.get('/keys/:key', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;

        try {
            // Use cluster-aware key retrieval
            const result = await getKeyFromCluster(key, env);

            // Format hash values as clean key-value pairs if needed
            if (result.type === 'hash' && typeof result.value === 'string' && !result.value.includes(':')) {
                const lines = result.value.split('\n').filter(line => line.trim() !== '');
                if (lines.length > 0 && lines.length % 2 === 0) {
                    const formattedResult = {};
                    for (let i = 0; i < lines.length; i += 2) {
                        formattedResult[lines[i].trim()] = lines[i+1].trim();
                    }
                    result.value = formattedResult;
                }
            }

            res.json(result);

        } catch {
            return res.status(404).json({
                error: 'Key not found',
                message: 'This key was found in search results but does not actually exist (ghost key)',
                key
            });
        }
    } catch (error) {
        console.error(`Error retrieving key ${req.params.key}:`, error);
        res.status(500).json(error);
    }
});

// Check if a key exists
router.get('/keys/:key/exists', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;

        try {
            // Use cluster-aware key checking - if it doesn't throw, key exists
            await getKeyFromCluster(key, env);
            res.json({ exists: true });
        } catch {
            // Key not found
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking key existence:', error);
        res.status(500).json(error);
    }
});

// Set a key (string value)
router.post('/keys', async (req, res) => {
    try {
        const env = req.query.env;
        const { key, value, expiry } = req.body;

        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key and value are required' });
        }

        // Handle different value types
        let strValue;
        if (typeof value === 'object') {
            strValue = JSON.stringify(value);
        } else {
            strValue = String(value);
        }

        // Escape quotes and special characters in the value
        const escapedValue = strValue
            .replace(/"/g, '\\"')          // Escape double quotes
            .replace(/(\r\n|\n|\r)/g, '\\n'); // Escape newlines

        let command = `SET "${key}" "${escapedValue}"`;

        if (expiry) {
            command += ` EX ${expiry}`;
        }

        // Execute SET with proper cluster handling
        let result;
        let targetNode = null;

        try {
            result = await execRedisCommand(command, env);

            // Check for MOVED response
            if (result.includes('MOVED')) {
                // Parse the MOVED response: "MOVED slot target-host:target-port"
                const movedMatch = result.match(/MOVED\s+\d+\s+([^:]+):(\d+)/);
                if (movedMatch) {
                    const targetHost = movedMatch[1];
                    const targetPort = parseInt(movedMatch[2]);

                    targetNode = {
                        id: `${targetHost}:${targetPort}`,
                        host: targetHost,
                        port: targetPort
                    };

                    // Retry SET on the correct node
                    result = await execRedisCommand(command, env, targetNode);
                }
            }
        } catch (error) {
            console.error('Error executing SET:', error);
            throw error;
        }

        // Verify the key was set successfully, using the same target node if redirected
        const existsCommand = `EXISTS "${key}"`;
        let exists;
        if (targetNode) {
            exists = await execRedisCommand(existsCommand, env, targetNode);
        } else {
            exists = await execRedisCommand(existsCommand, env);
        }
        const keyExists = parseInt(exists.trim()) === 1;

        res.json({
            result,
            key,
            success: result === 'OK' || keyExists,
            valueLength: strValue.length
        });
    } catch (error) {
        console.error('Error setting key:', error);
        res.status(500).json(error);
    }
});

// Delete a key
router.delete('/keys/:key', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;

        // Delete the key
        const result = await execRedisCommand(`DEL "${key}"`, env);
        const deletedCount = parseInt(result.trim());

        res.json({
            deleted: deletedCount > 0,
            count: deletedCount,
            key
        });
    } catch (error) {
        console.error(`Error deleting key ${req.params.key}:`, error);
        res.status(500).json(error);
    }
});

// Delete keys by pattern
router.delete('/allkeys', async (req, res) => {
    try {
        const env = req.query.env;
        const pattern = req.query.pattern;

        if (!pattern) {
            return res.status(400).json({ error: 'Pattern parameter is required' });
        }

        // First get all keys matching the pattern using cluster-aware scanning
        const keys = [];
        let cursors = ['0'];
        let hasMore = true;

        // Keep scanning until we get all keys
        while (hasMore) {
            const result = await scanClusterNodes(pattern, cursors, 10000, env);
            keys.push(...result.keys);
            cursors = result.cursors;
            hasMore = result.hasMore;
        }

        if (keys.length === 0) {
            return res.json({ count: 0, message: 'No keys found matching the pattern' });
        }

        // Delete each key individually instead of using Promise.all
        let deletedCount = 0;
        for (const key of keys) {
            try {
                const delResult = await execRedisCommand(`DEL "${key}"`, env);
                deletedCount += parseInt(delResult.trim()) || 0;
            } catch (e) {
                console.error(`Error deleting key "${key}":`, e);
            }
        }

        res.json({
            count: deletedCount,
            totalFound: keys.length,
            message: `Deleted ${deletedCount} of ${keys.length} keys`
        });
    } catch (error) {
        console.error('Error deleting keys by pattern:', error);
        res.status(500).json(error);
    }
});

// Get total number of keys in database
router.get('/keycount', async (req, res) => {
    try {
        const env = req.query.env;
        const result = await execRedisCommand('DBSIZE', env);
        const keyCount = parseInt(result) || 0;
        res.json({ count: keyCount });
    } catch (error) {
        console.error('Error getting key count:', error);
        res.status(500).json(error);
    }
});

// Rename a key
router.post('/keys/:key/rename', async (req, res) => {
    try {
        const env = req.query.env;
        const oldKey = req.params.key;
        const { newKey } = req.body;

        if (!newKey) {
            return res.status(400).json({ error: 'New key name is required' });
        }

        const result = await execRedisCommand(`RENAME "${oldKey}" "${newKey}"`, env);
        res.json({ result, oldKey, newKey });
    } catch (error) {
        res.status(500).json(error);
    }
});

// Set expiry on a key
router.post('/keys/:key/expire', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;
        const { seconds } = req.body;

        if (seconds === undefined) {
            return res.status(400).json({ error: 'Expiry seconds are required' });
        }

        let result;
        if (parseInt(seconds) < 0) {
            // Remove expiry
            result = await execRedisCommand(`PERSIST "${key}"`, env);
        } else {
            // Set expiry
            result = await execRedisCommand(`EXPIRE "${key}" ${seconds}`, env);
        }

        res.json({ result, key, ttl: parseInt(seconds) });
    } catch (error) {
        res.status(500).json(error);
    }
});

// Copy a key to another environment
router.post('/keys/:key/copy', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;
        const { targetKey, targetEnv } = req.body;

        if (!targetKey) {
            return res.status(400).json({ error: 'Target key name is required' });
        }

        const targetEnvironment = targetEnv || env;

        // Get the source key details using cluster-aware retrieval
        const sourceKeyData = await getKeyFromCluster(key, env);
        const { type, ttl, value } = sourceKeyData;

        // Use the DUMP/RESTORE method to copy keys
        try {
            // For simple string keys, use the value we already retrieved
            if (type === 'string') {
                let setCmd = `SET "${targetKey}" "${value.replace(/"/g, '\\"')}"`;

                if (ttl > 0) {
                    setCmd += ` EX ${ttl}`;
                }

                await execRedisCommand(setCmd, targetEnvironment);

                res.json({
                    result: 'Key copied successfully',
                    sourceKey: key,
                    targetKey,
                    targetEnv: targetEnvironment
                });
            } else {
                // Use DUMP and RESTORE for complex data types
                // We need to get the DUMP from the same node that has the key
                let dumpResult;

                try {
                    // Try to find which node has the key and dump from there
                    const clusterMode = await require('../services/redis').isClusterMode(env);

                    if (clusterMode) {
                        const nodes = await require('../services/redis').getClusterNodes(env);
                        for (const node of nodes) {
                            try {
                                const existsResult = await execRedisCommand(`EXISTS "${key}"`, env, node);
                                if (parseInt(existsResult.trim()) === 1) {
                                    dumpResult = await execRedisCommand(`--raw DUMP "${key}"`, env, node);
                                    break;
                                }
                            } catch {
                                // Continue to next node
                            }
                        }
                    } else {
                        dumpResult = await execRedisCommand(`--raw DUMP "${key}"`, env);
                    }
                } catch {
                    dumpResult = await execRedisCommand(`--raw DUMP "${key}"`, env);
                }

                if (dumpResult) {
                    // Escape any quotes in dumpResult for command line safety
                    const escapedDump = dumpResult.replace(/"/g, '\\"');

                    let restoreCmd = `RESTORE "${targetKey}" `;

                    // If TTL is -1 (no expiry), use 0, otherwise use the remaining TTL
                    if (ttl === -1) {
                        restoreCmd += '0 ';
                    } else {
                        restoreCmd += `${ttl * 1000} `; // RESTORE takes milliseconds
                    }

                    restoreCmd += `"${escapedDump}" REPLACE`;

                    // Restore to target environment
                    await execRedisCommand(restoreCmd, targetEnvironment);

                    res.json({
                        result: 'Key copied successfully',
                        sourceKey: key,
                        targetKey,
                        targetEnv: targetEnvironment
                    });
                } else {
                    res.status(500).json({ error: 'Failed to dump key' });
                }
            }
        } catch (error) {
            console.error('Error copying key:', error);
            res.status(500).json(error);
        }
    } catch (error) {
        console.error('Error copying key:', error);
        res.status(500).json(error);
    }
});

// Add members to a sorted set (ZSET)
router.post('/keys/:key/zadd', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;
        const { members, expiry } = req.body;

        if (!key || !members || !Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ error: 'Key and members array are required' });
        }

        // Build ZADD command with score-member pairs
        let command = `ZADD "${key}"`;

        for (const member of members) {
            if (typeof member.score !== 'number' || member.value === undefined) {
                return res.status(400).json({ error: 'Each member must have score (number) and value properties' });
            }

            const memberValue = String(member.value);

            // Escape quotes and backslashes for Redis command
            const escapedValue = memberValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            command += ` ${member.score} "${escapedValue}"`;
        }

        // Execute ZADD with proper cluster handling
        let result;
        let targetNode = null;

        try {
            result = await execRedisCommand(command, env);

            // Check for MOVED response
            if (result.includes('MOVED')) {
                // Parse the MOVED response: "MOVED slot target-host:target-port"
                const movedMatch = result.match(/MOVED\s+\d+\s+([^:]+):(\d+)/);
                if (movedMatch) {
                    const targetHost = movedMatch[1];
                    const targetPort = parseInt(movedMatch[2]);

                    targetNode = {
                        id: `${targetHost}:${targetPort}`,
                        host: targetHost,
                        port: targetPort
                    };

                    // Retry ZADD on the correct node
                    result = await execRedisCommand(command, env, targetNode);
                }
            }
        } catch (error) {
            console.error('Error executing ZADD:', error);
            throw error;
        }

        // Set expiry if specified, using the same target node if redirected
        if (expiry && expiry > 0) {
            const expireCommand = `EXPIRE "${key}" ${expiry}`;
            if (targetNode) {
                await execRedisCommand(expireCommand, env, targetNode);
            } else {
                await execRedisCommand(expireCommand, env);
            }
        }

        // Verify the key was set successfully, using the same target node if redirected
        const existsCommand = `EXISTS "${key}"`;
        let exists;
        if (targetNode) {
            exists = await execRedisCommand(existsCommand, env, targetNode);
        } else {
            exists = await execRedisCommand(existsCommand, env);
        }
        const keyExists = parseInt(exists.trim()) === 1;

        res.json({
            result,
            key,
            success: keyExists,
            membersAdded: parseInt(result.trim()) || 0
        });
    } catch (error) {
        console.error('Error adding to ZSET:', error);
        res.status(500).json(error);
    }
});

module.exports = router;
