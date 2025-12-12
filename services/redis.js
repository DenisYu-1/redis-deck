const { execSync } = require('child_process');
const { getConnectionConfig } = require('./database');

// Execute Redis command using redis-cli
async function execRedisCommand(command, connectionId, nodeOverride = null) {
    try {
        // Get Redis configuration from the database
        const config = getConnectionConfig(connectionId);

        // Use node override if provided (for cluster mode)
        const host = nodeOverride?.host || config.host;
        const port = nodeOverride?.port || config.port;

        console.log(
            `Executing redis-cli command for ${connectionId}${nodeOverride ? ` on node ${nodeOverride.id}` : ''}`
        );

        // Build redis-cli command
        let cliCommand = 'redis-cli';

        // Add connection parameters
        cliCommand += ` -h ${host}`;
        cliCommand += ` -p ${port}`;

        // Add authentication if needed
        if (config.username) {
            cliCommand += ` --user ${config.username}`;
        }
        if (config.password) {
            cliCommand += ` -a ${config.password}`;
        }

        // Add TLS if enabled
        if (config.tls) {
            cliCommand += ' --tls --insecure'; // --insecure skips certificate validation
        }

        // Determine command type for output formatting
        const cmd = command.trim().split(/\s+/)[0].toUpperCase();
        const isScan = cmd === 'SCAN';
        const isKeys = cmd === 'KEYS';
        const isGet = cmd === 'GET';
        const isHgetall = cmd === 'HGETALL';
        const isSet = cmd === 'SET';

        // For raw commands, we'll use the --raw flag
        if (command.startsWith('--raw ')) {
            command = command.substring(6);
            cliCommand += ' --raw';
        }
        // For SCAN we want CSV for easier parsing
        else if (isScan) {
            cliCommand += ' --csv';
        }

        // For large SET commands, print only a preview of the value
        if (isSet) {
            const valueMatch = command.match(/SET\s+"[^"]+"\s+"(.*)"/i);
            if (valueMatch && valueMatch[1] && valueMatch[1].length > 50) {
                const preview = valueMatch[1].substring(0, 50);
                console.log(
                    `SET command with large value (${valueMatch[1].length} chars), preview: ${preview}...`
                );
            }
        }

        // Add the actual Redis command
        cliCommand += ` ${command}`;

        console.log(
            `Executing: ${cliCommand.replace(/-a [^ ]+/, '-a ******')}`
        );

        // Execute command and get output
        const result = execSync(cliCommand, {
            encoding: 'utf8',
            timeout: 10000 // 10 seconds timeout
        });

        // Process the result to handle redis-cli formatting
        let processedResult = result.trim();

        // Format results based on command type
        if (isGet) {
            // GET returns the string value directly
            processedResult = processedResult.replace(/^"(.*)"$/, '$1'); // Remove quotes if present
        } else if (isHgetall) {
            // Format hash results as key-value pairs
            const lines = processedResult
                .split('\n')
                .filter((line) => line.trim() !== '');
            if (lines.length > 0 && lines.length % 2 === 0) {
                const formattedResult = [];
                for (let i = 0; i < lines.length; i += 2) {
                    formattedResult.push(`${lines[i]}: ${lines[i + 1]}`);
                }
                processedResult = formattedResult.join('\n');
            }
        } else if (isScan || isKeys) {
            // Ensure consistent key formatting for SCAN and KEYS
            if (processedResult && !isScan) {
                // KEYS returns newline-separated results
                processedResult = processedResult
                    .split('\n')
                    .filter((k) => k.trim() !== '')
                    .join('\n');
            }
        } else if (cmd === 'DEL' && processedResult === 'OK') {
            processedResult = '1'; // CLI might return OK instead of 1
        }

        console.log(
            `Command ${cmd} result (${processedResult.length} chars): ${processedResult.substring(0, 100)}${processedResult.length > 100 ? '...' : ''}`
        );

        // Check if the result contains a Redis error
        if (
            processedResult.startsWith('ERR ') ||
            processedResult.startsWith('WRONGTYPE ') ||
            processedResult.startsWith('NOPERM ') ||
            processedResult.startsWith('NOAUTH ') ||
            processedResult.includes('ERR unknown command')
        ) {
            throw {
                message: processedResult,
                command,
                code: 'REDIS_ERROR'
            };
        }

        return processedResult;
    } catch (error) {
        console.error(
            `Error executing Redis command (${command}):`,
            error.message || error
        );

        // Handle common errors
        if (error.stderr && error.stderr.includes('Connection refused')) {
            throw {
                message: 'Connection refused - Redis server not available',
                command,
                code: 'ECONNREFUSED'
            };
        }

        throw {
            message: error.message || 'Unknown Redis error',
            command,
            code: error.status || 'ERR'
        };
    }
}

// Parse Redis INFO command output into sections
function parseRedisInfo(infoString) {
    const sections = {};
    let currentSection = 'server';
    sections[currentSection] = {};

    infoString.split('\n').forEach((line) => {
        line = line.trim();
        if (!line) {
            return;
        }

        // Check if this is a section header
        if (line.startsWith('# ')) {
            currentSection = line.substring(2).toLowerCase();
            sections[currentSection] = {};
            return;
        }

        // Parse key-value pair
        const colonPos = line.indexOf(':');
        if (colonPos !== -1) {
            const key = line.substring(0, colonPos);
            const value = line.substring(colonPos + 1);
            sections[currentSection][key] = value;
        }
    });

    return sections;
}

// Check if Redis is running in cluster mode
async function isClusterMode(connectionId) {
    try {
        const config = getConnectionConfig(connectionId);
        return config.cluster === 1 || config.cluster === true;
    } catch (error) {
        console.error('Error checking cluster mode:', error);
        return false;
    }
}

// Get cluster nodes if in cluster mode
async function getClusterNodes(connectionId) {
    try {
        const config = getConnectionConfig(connectionId);

        if (!config.cluster) {
            // For standalone Redis, return an array with a single node (the main connection)
            return [
                {
                    id: '0', // Default ID for standalone mode
                    host: config.host,
                    port: config.port
                }
            ];
        }

        // For cluster mode, get all nodes using CLUSTER NODES command
        const nodesInfo = await execRedisCommand('CLUSTER NODES', connectionId);

        // Parse the CLUSTER NODES output
        // Example output format:
        // <node-id> <ip:port> <flags> <master-id> <ping-sent> <pong-recv> <config-epoch> <link-state> <slot> <slot> ... <slot>
        const nodes = nodesInfo
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const parts = line.trim().split(' ');
                if (parts.length < 2) return null;

                const nodeId = parts[0];
                const addressParts = parts[1].split('@')[0].split(':');
                const host = addressParts[0];
                const port = parseInt(addressParts[1]);
                const flags = parts[2].split(',');
                const isMaster =
                    !flags.includes('slave') && !flags.includes('replica');

                return {
                    id: nodeId,
                    host,
                    port,
                    isMaster,
                    flags
                };
            })
            .filter((node) => node !== null);

        // Use only master nodes for search operations
        const masterNodes = nodes.filter((node) => node.isMaster);

        // If no master nodes found, return all nodes as fallback
        return masterNodes.length > 0 ? masterNodes : nodes;
    } catch (error) {
        console.error('Error getting cluster nodes:', error);
        // Fallback to standalone mode if there's an error
        return [
            {
                id: '0',
                host: 'localhost',
                port: 6379
            }
        ];
    }
}

// Get a specific key from cluster nodes (tries all nodes until found)
async function getKeyFromCluster(key, connectionId) {
    try {
        const clusterMode = await isClusterMode(connectionId);

        if (!clusterMode) {
            // For standalone mode, just get the key normally
            const existsResult = await execRedisCommand(
                `EXISTS "${key}"`,
                connectionId
            );
            const keyExists = parseInt(existsResult.trim()) === 1;

            if (!keyExists) {
                throw new Error('Key not found');
            }

            // Get the type and value
            const typeResult = await execRedisCommand(
                `TYPE "${key}"`,
                connectionId
            );
            const type = typeResult.trim();

            const ttlResult = await execRedisCommand(
                `TTL "${key}"`,
                connectionId
            );
            const ttl = parseInt(ttlResult.trim());

            let value;
            switch (type) {
                case 'string':
                    value = await execRedisCommand(
                        `--raw GET "${key}"`,
                        connectionId
                    );
                    break;
                case 'hash':
                    value = await execRedisCommand(
                        `HGETALL "${key}"`,
                        connectionId
                    );
                    break;
                case 'list':
                    value = await execRedisCommand(
                        `--raw LRANGE "${key}" 0 999`,
                        connectionId
                    );
                    break;
                case 'set':
                    value = await execRedisCommand(
                        `--raw SSCAN "${key}" 0 COUNT 1000`,
                        connectionId
                    );
                    break;
                case 'zset':
                    value = await execRedisCommand(
                        `ZRANGE "${key}" 0 -1 WITHSCORES`,
                        connectionId
                    );
                    break;
                default:
                    value = `Unsupported type: ${type}`;
            }

            return { key, type, value, ttl };
        }

        // Get all cluster nodes
        const nodes = await getClusterNodes(connectionId);

        // Try each node until we find the key, handling MOVED redirects
        for (const node of nodes) {
            try {
                const existsResult = await execRedisCommand(
                    `EXISTS "${key}"`,
                    connectionId,
                    node
                );

                // Check for MOVED response (Redis cluster redirect)
                if (existsResult.includes('MOVED')) {
                    console.log(
                        `Got MOVED response for key "${key}" on node ${node.id}: ${existsResult}`
                    );

                    // Parse the MOVED response: "MOVED slot target-host:target-port"
                    const movedMatch = existsResult.match(
                        /MOVED\s+\d+\s+([^:]+):(\d+)/
                    );
                    if (movedMatch) {
                        const targetHost = movedMatch[1];
                        const targetPort = parseInt(movedMatch[2]);

                        console.log(
                            `Redirecting to correct node: ${targetHost}:${targetPort}`
                        );

                        // Create target node object
                        const targetNode = {
                            id: `${targetHost}:${targetPort}`,
                            host: targetHost,
                            port: targetPort
                        };

                        // Try the redirected node
                        const redirectedExists = await execRedisCommand(
                            `EXISTS "${key}"`,
                            connectionId,
                            targetNode
                        );
                        const keyExists =
                            parseInt(redirectedExists.trim()) === 1;

                        if (keyExists) {
                            console.log(
                                `Found key "${key}" on redirected node ${targetNode.id}`
                            );

                            // Get the type and value from the correct node
                            const typeResult = await execRedisCommand(
                                `TYPE "${key}"`,
                                connectionId,
                                targetNode
                            );
                            const type = typeResult.trim();

                            const ttlResult = await execRedisCommand(
                                `TTL "${key}"`,
                                connectionId,
                                targetNode
                            );
                            const ttl = parseInt(ttlResult.trim());

                            let value;
                            switch (type) {
                                case 'string':
                                    value = await execRedisCommand(
                                        `--raw GET "${key}"`,
                                        connectionId,
                                        targetNode
                                    );
                                    break;
                                case 'hash':
                                    value = await execRedisCommand(
                                        `HGETALL "${key}"`,
                                        connectionId,
                                        targetNode
                                    );
                                    break;
                                case 'list':
                                    value = await execRedisCommand(
                                        `--raw LRANGE "${key}" 0 999`,
                                        connectionId,
                                        targetNode
                                    );
                                    break;
                                case 'set':
                                    value = await execRedisCommand(
                                        `--raw SSCAN "${key}" 0 COUNT 1000`,
                                        connectionId,
                                        targetNode
                                    );
                                    break;
                                case 'zset':
                                    value = await execRedisCommand(
                                        `ZRANGE "${key}" 0 -1 WITHSCORES`,
                                        connectionId,
                                        targetNode
                                    );
                                    break;
                                default:
                                    value = `Unsupported type: ${type}`;
                            }

                            return {
                                key,
                                type,
                                value,
                                ttl,
                                nodeId: targetNode.id
                            };
                        }
                    }
                    continue; // Continue to next node if redirect failed
                }

                const keyExists = parseInt(existsResult.trim()) === 1;

                if (keyExists) {
                    console.log(`Found key "${key}" on node ${node.id}`);

                    // Get the type and value from this node
                    const typeResult = await execRedisCommand(
                        `TYPE "${key}"`,
                        connectionId,
                        node
                    );
                    const type = typeResult.trim();

                    const ttlResult = await execRedisCommand(
                        `TTL "${key}"`,
                        connectionId,
                        node
                    );
                    const ttl = parseInt(ttlResult.trim());

                    let value;
                    switch (type) {
                        case 'string':
                            value = await execRedisCommand(
                                `--raw GET "${key}"`,
                                connectionId,
                                node
                            );
                            break;
                        case 'hash':
                            value = await execRedisCommand(
                                `HGETALL "${key}"`,
                                connectionId,
                                node
                            );
                            break;
                        case 'list':
                            value = await execRedisCommand(
                                `--raw LRANGE "${key}" 0 999`,
                                connectionId,
                                node
                            );
                            break;
                        case 'set':
                            value = await execRedisCommand(
                                `--raw SSCAN "${key}" 0 COUNT 1000`,
                                connectionId,
                                node
                            );
                            break;
                        case 'zset':
                            value = await execRedisCommand(
                                `ZRANGE "${key}" 0 -1 WITHSCORES`,
                                connectionId,
                                node
                            );
                            break;
                        default:
                            value = `Unsupported type: ${type}`;
                    }

                    return { key, type, value, ttl, nodeId: node.id };
                }
            } catch (error) {
                console.log(
                    `Error checking key "${key}" on node ${node.id}:`,
                    error.message
                );
                // Continue to next node
            }
        }

        // Key not found on any node
        throw new Error('Key not found');
    } catch (error) {
        console.error('Error getting key from cluster:', error);
        throw error;
    }
}

// Execute SCAN command across all cluster nodes and aggregate results
async function scanClusterNodes(pattern, cursors, count, connectionId) {
    try {
        const clusterMode = await isClusterMode(connectionId);

        if (!clusterMode) {
            // For standalone mode, execute single SCAN command
            const cursor =
                Array.isArray(cursors) && cursors.length > 0 ? cursors[0] : '0';
            const safePattern = String(pattern)
                .replace(/"/g, '\\"')
                .replace(/'/g, "'\\''");
            const scanCmd = `SCAN ${cursor} MATCH '${safePattern}' COUNT ${count}`;
            const result = await execRedisCommand(scanCmd, connectionId);

            // Parse the CSV output
            const parts = result.split(',');
            const nextCursor = parts[0].trim().replace(/^"(.*)"$/, '$1');
            const keys = parts
                .slice(1)
                .map((key) => key.trim().replace(/^"(.*)"$/, '$1'))
                .filter((key) => key.length > 0);

            return {
                keys,
                cursors: [nextCursor],
                hasMore: nextCursor !== '0'
            };
        }

        // Get all cluster nodes
        const nodes = await getClusterNodes(connectionId);

        let allKeys = [];
        const nextCursors = [];
        let hasMore = false;

        // Execute SCAN on each node
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const cursor =
                Array.isArray(cursors) && cursors[i] ? cursors[i] : '0';

            try {
                const safePattern = String(pattern)
                    .replace(/"/g, '\\"')
                    .replace(/'/g, "'\\''");
                const scanCmd = `SCAN ${cursor} MATCH '${safePattern}' COUNT ${count}`;
                const result = await execRedisCommand(
                    scanCmd,
                    connectionId,
                    node
                );

                // Parse the CSV output
                const parts = result.split(',');
                const nextCursor = parts[0].trim().replace(/^"(.*)"$/, '$1');
                const nodeKeys = parts
                    .slice(1)
                    .map((key) => key.trim().replace(/^"(.*)"$/, '$1'))
                    .filter((key) => key.length > 0);

                // Add keys from this node
                allKeys = allKeys.concat(nodeKeys);

                // Store next cursor for this node
                nextCursors[i] = nextCursor;

                // Check if this node has more keys
                if (nextCursor !== '0') {
                    hasMore = true;
                }

                console.log(
                    `Node ${node.id}: found ${nodeKeys.length} keys, next cursor: ${nextCursor}`
                );
            } catch (error) {
                console.error(`Error scanning node ${node.id}:`, error);
                // Set cursor to '0' for failed node
                nextCursors[i] = '0';
            }
        }

        console.log(
            `Cluster scan complete: ${allKeys.length} total keys across ${nodes.length} nodes`
        );

        return {
            keys: allKeys,
            cursors: nextCursors,
            hasMore
        };
    } catch (error) {
        console.error('Error executing cluster scan:', error);
        throw error;
    }
}

async function execRedisPipelinedCommands(
    commands,
    connectionId,
    nodeOverride = null
) {
    try {
        const config = getConnectionConfig(connectionId);
        const host = nodeOverride?.host || config.host;
        const port = nodeOverride?.port || config.port;

        let cliCommand = 'redis-cli';
        cliCommand += ` -h ${host}`;
        cliCommand += ` -p ${port}`;

        if (config.username) {
            cliCommand += ` --user ${config.username}`;
        }
        if (config.password) {
            cliCommand += ` -a ${config.password}`;
        }
        if (config.tls) {
            cliCommand += ' --tls --insecure';
        }

        const fullCommand = `printf '%s\\n' ${commands.map((cmd) => `"${cmd}"`).join(' ')} | ${cliCommand}`;

        console.log(
            `Executing ${commands.length} pipelined commands for ${connectionId}`
        );

        const result = execSync(fullCommand, {
            encoding: 'utf8',
            timeout: 120000,
            shell: true
        });

        const lines = result
            .trim()
            .split('\n')
            .filter((line) => line.trim() !== '');

        console.log(`Pipelined results: ${lines.length} lines received`);

        return lines;
    } catch (error) {
        console.error(
            'Error executing pipelined Redis commands:',
            error.message
        );
        throw {
            message: error.message || 'Unknown Redis pipelining error',
            code: error.status || 'ERR'
        };
    }
}

module.exports = {
    execRedisCommand,
    execRedisPipelinedCommands,
    parseRedisInfo,
    isClusterMode,
    getClusterNodes,
    scanClusterNodes,
    getKeyFromCluster
};
