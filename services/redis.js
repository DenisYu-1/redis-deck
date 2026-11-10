const { execFile } = require('child_process');
const { getConnectionConfig } = require('./database');
const { getClient } = require('./redisClient');

// Split a redis command string into an argv array, honouring '...' / "..."
// quoting and backslash escapes inside double quotes.
// ponytail: no nested-quote support beyond \" — matches how the routes build
// commands (each value wrapped in a single pair of quotes). If a route ever
// needs richer quoting, pass an argv array instead of a string.
function tokenize(str) {
    const tokens = [];
    let cur = '';
    let quote = null;
    let started = false;

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (quote) {
            if (ch === '\\' && quote === '"' && i + 1 < str.length) {
                cur += str[++i];
            } else if (ch === quote) {
                quote = null;
            } else {
                cur += ch;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            started = true;
        } else if (/\s/.test(ch)) {
            if (started) {
                tokens.push(cur);
                cur = '';
                started = false;
            }
        } else {
            cur += ch;
            started = true;
        }
    }
    if (started) {
        tokens.push(cur);
    }
    return tokens;
}

// Connection flags for redis-cli, as an argv array (never a shell string, so
// host/port/credentials cannot be interpreted by a shell).
function connArgs(config, nodeOverride = null) {
    const host = nodeOverride?.host || config.host;
    const port = nodeOverride?.port || config.port;

    const args = ['-h', String(host), '-p', String(port)];
    if (config.username) {
        args.push('--user', String(config.username));
    }
    if (config.password) {
        args.push('-a', String(config.password), '--no-auth-warning');
    }
    if (config.tls) {
        args.push('--tls', '--insecure');
    }
    return args;
}

// Async, non-blocking spawn of redis-cli. No shell => no command injection.
function runRedisCli(args, { input = null, timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = execFile(
            'redis-cli',
            args,
            { encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (err) {
                    err.stdout = stdout;
                    err.stderr = stderr;
                    return reject(err);
                }
                resolve(stdout);
            }
        );
        if (input != null) {
            child.stdin.write(input);
            child.stdin.end();
        }
    });
}

const REDIS_ERROR_PREFIXES = ['ERR ', 'WRONGTYPE ', 'NOPERM ', 'NOAUTH '];

function looksLikeRedisError(text) {
    const t = text.replace(/^\(error\)\s*/, '');
    return (
        REDIS_ERROR_PREFIXES.some((p) => t.startsWith(p)) ||
        t.includes('ERR unknown command')
    );
}

// Turn a failed redis-cli spawn into the {message, command, code} error shape.
function cliError(error, command) {
    const text = `${error.stdout || ''}${error.stderr || ''}`.trim();
    if (text.includes('Connection refused')) {
        return {
            message: 'Connection refused - Redis server not available',
            command,
            code: 'ECONNREFUSED'
        };
    }
    if (text && looksLikeRedisError(text)) {
        return {
            message: text.replace(/^\(error\)\s*/, ''),
            command,
            code: 'REDIS_ERROR'
        };
    }
    console.error(
        `Error executing Redis command (${command}):`,
        error.message || error
    );
    return {
        message: text || error.message || 'Unknown Redis error',
        command,
        code: error.code || 'ERR'
    };
}

async function runCommand(command, config, nodeOverride, label) {
    let raw = false;
    if (command.startsWith('--raw ')) {
        raw = true;
        command = command.substring(6);
    }

    const argv = tokenize(command);
    const cmd = (argv[0] || '').toUpperCase();
    const isScan = cmd === 'SCAN';
    const isKeys = cmd === 'KEYS';
    const isGet = cmd === 'GET';
    const isHgetall = cmd === 'HGETALL';

    const flags = [];
    if (raw) {
        flags.push('--raw');
    } else if (isScan) {
        // CSV keeps SCAN output easy to parse (cursor,key,key,...)
        flags.push('--csv');
    }

    const args = [...connArgs(config, nodeOverride), ...flags, ...argv];

    // P0.5: log only the redis command, never connection flags / credentials.
    console.log(`redis-cli [${label}]: ${argv.join(' ')}`);

    let out;
    try {
        out = await runRedisCli(args, { timeout: 10000 });
    } catch (error) {
        throw cliError(error, command);
    }

    let processedResult = out.trim();

    if (isGet) {
        processedResult = processedResult.replace(/^"(.*)"$/, '$1');
    } else if (isHgetall) {
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
    } else if (isKeys && processedResult) {
        processedResult = processedResult
            .split('\n')
            .filter((k) => k.trim() !== '')
            .join('\n');
    } else if (cmd === 'DEL' && processedResult === 'OK') {
        processedResult = '1';
    }

    console.log(
        `Command ${cmd} result (${processedResult.length} chars): ${processedResult.substring(0, 100)}${processedResult.length > 100 ? '...' : ''}`
    );

    // Some redis-cli versions print errors to stdout and exit 0.
    if (looksLikeRedisError(processedResult)) {
        throw {
            message: processedResult.replace(/^\(error\)\s*/, ''),
            command,
            code: 'REDIS_ERROR'
        };
    }

    return processedResult;
}

// Execute a Redis command against a saved connection.
async function execRedisCommand(command, connectionId, nodeOverride = null) {
    const config = getConnectionConfig(connectionId);
    return runCommand(command, config, nodeOverride, connectionId);
}

// Run one command given as an argv array (no quoting/escaping to get wrong)
// and return the parsed JSON reply. Redis errors (incl. MOVED) are thrown.
async function execArgv(argv, connectionId, nodeOverride = null) {
    const config = getConnectionConfig(connectionId);
    const args = [
        ...connArgs(config, nodeOverride),
        '--json',
        ...argv.map(String)
    ];
    console.log(`redis-cli [${connectionId}]: ${argv[0]} ${argv[1] ?? ''}`);
    let out;
    try {
        out = (await runRedisCli(args)).trim();
    } catch (error) {
        throw cliError(error, argv[0]);
    }
    // redis-cli --json prints errors as: error:"ERR ..."
    if (out.startsWith('error:')) {
        throw {
            message: JSON.parse(out.slice(6)),
            command: argv[0],
            code: 'REDIS_ERROR'
        };
    }
    return out ? JSON.parse(out) : null;
}

// Execute a Redis command against an unsaved config (used by "test connection").
async function execRedisCommandWithConfig(command, config) {
    return runCommand(command, config, null, `${config.host}:${config.port}`);
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

        if (line.startsWith('# ')) {
            currentSection = line.substring(2).toLowerCase();
            sections[currentSection] = {};
            return;
        }

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
            return [
                {
                    id: '0',
                    host: config.host,
                    port: config.port
                }
            ];
        }

        const nodesInfo = await execRedisCommand('CLUSTER NODES', connectionId);

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

        const masterNodes = nodes.filter((node) => node.isMaster);

        return masterNodes.length > 0 ? masterNodes : nodes;
    } catch (error) {
        console.error('Error getting cluster nodes:', error);
        return [
            {
                id: '0',
                host: 'localhost',
                port: 6379
            }
        ];
    }
}

function parseScanCsv(result) {
    const parts = result.split(',');
    const nextCursor = parts[0].trim().replace(/^"(.*)"$/, '$1');
    const keys = parts
        .slice(1)
        .map((key) => key.trim().replace(/^"(.*)"$/, '$1'))
        .filter((key) => key.length > 0);
    return { nextCursor, keys };
}

// ponytail: no result cache here on purpose — SCAN feeds delete-then-rescan
// loops and post-write searches, where a stale hit is a correctness bug.
// Duplicate rapid fires are de-duped client-side (AbortController). The cheap
// repeated call (DBSIZE) is cached in routes/keys.js instead.
async function scanClusterNodes(
    pattern,
    cursors,
    count,
    connectionId,
    type = null
) {
    const clusterMode = await isClusterMode(connectionId);

    if (!clusterMode) {
        // Persistent socket — the route can loop SCAN hundreds of times to walk
        // a large keyspace without paying redis-cli process startup each call.
        const cursor =
            Array.isArray(cursors) && cursors.length > 0 ? cursors[0] : '0';
        const client = await getClient(connectionId);
        const reply = await client.scan(cursor, {
            MATCH: String(pattern),
            COUNT: count,
            ...(type ? { TYPE: type } : {})
        });
        const nextCursor = String(reply.cursor);
        return {
            keys: reply.keys,
            cursors: [nextCursor],
            hasMore: nextCursor !== '0'
        };
    }

    // Escape for the double-quoted arg the tokenizer will decode (no shell involved).
    const safePattern = String(pattern)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    const nodes = await getClusterNodes(connectionId);
    let allKeys = [];
    const nextCursors = [];
    let hasMore = false;

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const cursor = Array.isArray(cursors) && cursors[i] ? cursors[i] : '0';
        try {
            const result = await execRedisCommand(
                `SCAN ${cursor} MATCH "${safePattern}" COUNT ${count}${type ? ` TYPE ${type}` : ''}`,
                connectionId,
                node
            );
            const { nextCursor, keys } = parseScanCsv(result);
            allKeys = allKeys.concat(keys);
            nextCursors[i] = nextCursor;
            if (nextCursor !== '0') {
                hasMore = true;
            }
            console.log(
                `Node ${node.id}: found ${keys.length} keys, next cursor: ${nextCursor}`
            );
        } catch (error) {
            console.error(`Error scanning node ${node.id}:`, error);
            nextCursors[i] = '0';
        }
    }

    console.log(
        `Cluster scan complete: ${allKeys.length} total keys across ${nodes.length} nodes`
    );

    return { keys: allKeys, cursors: nextCursors, hasMore };
}

async function execRedisPipelinedCommands(
    commands,
    connectionId,
    nodeOverride = null
) {
    const config = getConnectionConfig(connectionId);
    const args = connArgs(config, nodeOverride);

    console.log(
        `redis-cli [${connectionId}]: ${commands.length} pipelined commands`
    );

    try {
        const out = await runRedisCli(args, {
            input: `${commands.join('\n')}\n`,
            timeout: 120000
        });
        const lines = out
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
            message:
                (error.stderr || error.message || '').trim() ||
                'Unknown Redis pipelining error',
            code: error.code || 'ERR'
        };
    }
}

module.exports = {
    execRedisCommand,
    execRedisCommandWithConfig,
    execRedisPipelinedCommands,
    parseRedisInfo,
    isClusterMode,
    getClusterNodes,
    scanClusterNodes,
    execArgv
};
