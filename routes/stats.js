const express = require('express');
const router = express.Router();
const {
    execRedisCommand,
    execRedisPipelinedCommands,
    parseRedisInfo
} = require('../services/redis');
const statsCollector = require('../services/statsCollector');

router.get('/realtime', async (req, res) => {
    try {
        const env = req.query.env;
        const infoResult = await execRedisCommand('INFO', env);
        const sections = parseRedisInfo(infoResult);

        const memory = sections.memory || {};
        const stats = sections.stats || {};
        const clients = sections.clients || {};
        const server = sections.server || {};
        const keyspace = sections.keyspace || {};
        const cpu = sections.cpu || {};

        let keysWithTTL = 0;
        let keysWithoutTTL = 0;
        for (const [key, value] of Object.entries(keyspace)) {
            if (key.startsWith('db')) {
                const expiresMatch = value.match(/expires=(\d+)/);
                const keysMatch = value.match(/keys=(\d+)/);
                if (expiresMatch && keysMatch) {
                    keysWithTTL += parseInt(expiresMatch[1]);
                    keysWithoutTTL +=
                        parseInt(keysMatch[1]) - parseInt(expiresMatch[1]);
                }
            }
        }

        res.json({
            memory: {
                used: parseInt(memory.used_memory) || 0,
                used_human: memory.used_memory_human,
                peak: parseInt(memory.used_memory_peak) || 0,
                peak_human: memory.used_memory_peak_human,
                rss: parseInt(memory.used_memory_rss) || 0,
                fragmentation: parseFloat(memory.mem_fragmentation_ratio) || 0,
                max: parseInt(memory.maxmemory) || 0,
                max_human: memory.maxmemory_human
            },
            stats: {
                keyspace_hits: parseInt(stats.keyspace_hits) || 0,
                keyspace_misses: parseInt(stats.keyspace_misses) || 0,
                evicted_keys: parseInt(stats.evicted_keys) || 0,
                expired_keys: parseInt(stats.expired_keys) || 0,
                ops_per_sec: parseInt(stats.instantaneous_ops_per_sec) || 0,
                total_net_input_bytes:
                    parseInt(stats.total_net_input_bytes) || 0,
                total_net_output_bytes:
                    parseInt(stats.total_net_output_bytes) || 0,
                total_connections_received:
                    parseInt(stats.total_connections_received) || 0,
                rejected_connections: parseInt(stats.rejected_connections) || 0
            },
            clients: {
                connected: parseInt(clients.connected_clients) || 0,
                blocked: parseInt(clients.blocked_clients) || 0
            },
            server: {
                uptime_days: parseInt(server.uptime_in_days) || 0,
                redis_version: server.redis_version
            },
            cpu: {
                used_cpu_sys: parseFloat(cpu.used_cpu_sys) || 0,
                used_cpu_user: parseFloat(cpu.used_cpu_user) || 0
            },
            keyspace,
            ttl_stats: {
                keys_with_ttl: keysWithTTL,
                keys_without_ttl: keysWithoutTTL
            }
        });
    } catch (error) {
        console.error('Error getting realtime stats:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/snapshot', async (req, res) => {
    try {
        const env = req.query.env;
        const snapshot = await statsCollector.collectSnapshot(env);
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/history', async (req, res) => {
    try {
        const env = req.query.env;
        const hours = parseInt(req.query.hours) || 24;

        const toTimestamp = Math.floor(Date.now() / 1000);
        const fromTimestamp = toTimestamp - hours * 3600;

        const data = await statsCollector.getMultiMetricHistory(
            env,
            fromTimestamp,
            toTimestamp
        );

        res.json({
            data,
            from: fromTimestamp,
            to: toTimestamp,
            count: data.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/commandstats', async (req, res) => {
    try {
        const env = req.query.env;

        const serverInfoResult = await execRedisCommand('INFO SERVER', env);
        const serverSections = parseRedisInfo(serverInfoResult);
        const server = serverSections.server || {};
        const uptimeSeconds = parseInt(server.uptime_in_seconds) || 1;

        const commandStatsResult = await execRedisCommand(
            'INFO COMMANDSTATS',
            env
        );
        const commandStatsSections = parseRedisInfo(commandStatsResult);
        const commandstats = commandStatsSections.commandstats || {};

        const commands = [];

        for (const [key, value] of Object.entries(commandstats)) {
            if (key.startsWith('cmdstat_')) {
                const cmdName = key.replace('cmdstat_', '');
                const callsMatch = value.match(/calls=(\d+)/);
                const usecMatch = value.match(/usec=(\d+)/);
                const usecPerCallMatch = value.match(/usec_per_call=([\d.]+)/);

                if (callsMatch) {
                    const calls = parseInt(callsMatch[1]);
                    const callsPerSecond = calls / uptimeSeconds;

                    commands.push({
                        command: cmdName,
                        calls: calls,
                        usec: parseInt(usecMatch ? usecMatch[1] : 0),
                        usec_per_call: parseFloat(
                            usecPerCallMatch ? usecPerCallMatch[1] : 0
                        ),
                        calls_per_sec: callsPerSecond
                    });
                }
            }
        }

        commands.sort((a, b) => b.calls - a.calls);

        res.json({
            commands: commands.slice(0, 20),
            uptime_seconds: uptimeSeconds,
            uptime_days: (uptimeSeconds / 86400).toFixed(2)
        });
    } catch (error) {
        console.error('Error getting command stats:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/memory-by-pattern', async (req, res) => {
    try {
        const env = req.query.env;
        const sampleSize = parseInt(req.query.sample) || 200;
        const fastMode = req.query.fast === 'true';

        const dbsizeResult = await execRedisCommand('DBSIZE', env);
        const totalKeys = parseInt(dbsizeResult.trim()) || 0;

        if (totalKeys === 0) {
            return res.json({ patterns: [], total_keys: 0, sampled_keys: 0 });
        }

        const patterns = {};
        const collectedKeys = [];
        let scannedKeys = 0;
        let cursors = ['0'];
        let hasMore = true;

        while (hasMore && scannedKeys < sampleSize) {
            const scanResult =
                await require('../services/redis').scanClusterNodes(
                    '*',
                    cursors,
                    Math.min(100, sampleSize - scannedKeys),
                    env
                );

            for (const key of scanResult.keys) {
                if (scannedKeys >= sampleSize) break;

                const pattern = extractPattern(key);

                if (!patterns[pattern]) {
                    patterns[pattern] = {
                        pattern,
                        count: 0,
                        total_memory: 0,
                        sample_keys: []
                    };
                }

                patterns[pattern].count++;

                if (patterns[pattern].sample_keys.length < 3) {
                    patterns[pattern].sample_keys.push(key);
                }

                if (!fastMode) {
                    collectedKeys.push({ key, pattern });
                }

                scannedKeys++;
            }

            cursors = scanResult.cursors;
            hasMore = scanResult.hasMore;
        }

        if (!fastMode && collectedKeys.length > 0) {
            const commands = collectedKeys.map(
                ({ key }) => `MEMORY USAGE "${key}"`
            );
            console.log(
                `Pipelining ${commands.length} MEMORY USAGE commands for all sampled keys`
            );

            const results = await execRedisPipelinedCommands(commands, env);

            console.log(
                `Received ${results.length} results, sample (first 5): ${results.slice(0, 5).join(', ')}`
            );

            for (
                let i = 0;
                i < collectedKeys.length && i < results.length;
                i++
            ) {
                const { pattern } = collectedKeys[i];
                const memoryBytes = parseInt(results[i]) || 0;

                if (memoryBytes > 0) {
                    patterns[pattern].total_memory += memoryBytes;
                }
            }

            console.log(
                `Memory calculated for ${Object.keys(patterns).length} patterns`
            );
        }

        const patternArray = Object.values(patterns).map((p) => ({
            pattern: p.pattern,
            count: p.count,
            total_memory: p.total_memory,
            avg_memory:
                p.count > 0 && p.total_memory > 0
                    ? Math.round(p.total_memory / p.count)
                    : 0,
            sample_keys: p.sample_keys,
            percentage: 0
        }));

        if (fastMode) {
            patternArray.sort((a, b) => b.count - a.count);
        } else {
            const totalMemory = patternArray.reduce(
                (sum, p) => sum + p.total_memory,
                0
            );

            patternArray.forEach((p) => {
                p.percentage =
                    totalMemory > 0
                        ? ((p.total_memory / totalMemory) * 100).toFixed(2)
                        : 0;
            });

            patternArray.sort((a, b) => b.total_memory - a.total_memory);
        }

        res.json({
            patterns: patternArray,
            total_keys: totalKeys,
            sampled_keys: scannedKeys,
            total_memory: patternArray.reduce(
                (sum, p) => sum + p.total_memory,
                0
            ),
            fast_mode: fastMode
        });
    } catch (error) {
        console.error('Error analyzing memory by pattern:', error);
        res.status(500).json({ error: error.message });
    }
});

function extractPattern(key) {
    const separators = [':', '_', '.', '/'];

    for (const sep of separators) {
        if (key.includes(sep)) {
            const parts = key.split(sep);

            if (parts.length >= 2) {
                const patternParts = [];

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];

                    if (/^\d+$/.test(part)) {
                        patternParts.push('*');
                        break;
                    } else if (/^[a-f0-9]{8,}$/i.test(part)) {
                        patternParts.push('*');
                        break;
                    } else if (
                        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                            part
                        )
                    ) {
                        patternParts.push('*');
                        break;
                    } else {
                        patternParts.push(part);
                    }
                }

                if (patternParts[patternParts.length - 1] !== '*') {
                    patternParts.push('*');
                }

                return patternParts.join(sep);
            }
        }
    }

    if (/\d+$/.test(key)) {
        return key.replace(/\d+$/, '*');
    }

    return key;
}

router.get('/slowlog', async (req, res) => {
    try {
        const env = req.query.env;
        const count = parseInt(req.query.count) || 10;

        const slowlogResult = await execRedisCommand(
            `SLOWLOG GET ${count}`,
            env
        );

        const lines = slowlogResult.split('\n').filter((line) => line.trim());
        const entries = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (/^\d+\)$/.test(line)) {
                const id = parseInt(lines[i + 1]) || 0;
                const timestamp = parseInt(lines[i + 2]) || 0;
                const duration = parseInt(lines[i + 3]) || 0;

                let j = i + 4;
                const commandParts = [];
                while (j < lines.length && !/^\d+\)$/.test(lines[j])) {
                    const part = lines[j].trim();
                    if (
                        part &&
                        !part.startsWith(')') &&
                        part !== '(empty array)'
                    ) {
                        const cleaned = part.replace(/^\d+\)\s*"?|"$/g, '');
                        if (cleaned) commandParts.push(cleaned);
                    }
                    j++;
                }

                if (commandParts.length > 0) {
                    entries.push({
                        id,
                        timestamp,
                        duration_us: duration,
                        command: commandParts.join(' ')
                    });
                }

                i = j - 1;
            }
        }

        res.json({ slowlog: entries });
    } catch (error) {
        console.error('Error getting slowlog:', error);
        res.json({ slowlog: [] });
    }
});

module.exports = router;
