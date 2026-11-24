// Read tools: never change Redis, so they skip the write guard.
const { z } = require('zod');
const { getAllConnections } = require('../../database');
const {
    scanClusterNodes,
    execRedisCommand,
    parseRedisInfo
} = require('../../redis');
const { readKey, readMeta } = require('../../keyStore');
const { getAiAccess } = require('../../aiAccess');

const MAX_VALUE_CHARS = 4096;
const MAX_VALUE_ITEMS = 100;
const MAX_SCAN_KEYS = 500;
const DEFAULT_SCAN_KEYS = 100;
const SCAN_BUDGET_MS = 2000;
const SCAN_HOP_COUNT = 1000;

const { connectionId } = require('./shared');

const listConnections = {
    name: 'list_connections',
    access: 'read',
    description:
        'List saved Redis Connections: id (pass it as connectionId to other tools), name, Tier, and whether writes are blocked (readOnly) or need user approval (confirmWrites).',
    inputSchema: {},
    run: async () => ({
        // Whitelist: never spread the row, it carries host/user/TLS fields.
        connections: getAllConnections()
            .filter((c) => getAiAccess(c.id).keys)
            .map((c) => ({
                id: c.id,
                name: c.id,
                tier: c.tier,
                readOnly: c.readOnly,
                confirmWrites: c.confirmWrites
            }))
    })
};

const scanKeys = {
    name: 'scan_keys',
    access: 'read',
    description: `Find Keys matching a Redis glob Key pattern (SCAN MATCH). Returns at most count Keys (max ${MAX_SCAN_KEYS}); truncated: true means more may exist, so narrow the pattern.`,
    inputSchema: {
        connectionId,
        pattern: z.string().default('*').describe('Glob, e.g. user:*'),
        count: z
            .number()
            .int()
            .positive()
            .default(DEFAULT_SCAN_KEYS)
            .describe(`Max Keys to return (capped at ${MAX_SCAN_KEYS})`)
    },
    run: async ({ connectionId: id, pattern, count }, { clock }) => {
        const limit = Math.min(count, MAX_SCAN_KEYS);
        const started = clock();
        const found = new Set();
        let cursors = ['0'];
        let hasMore = true;
        let failedNodes = [];
        // Same shape as GET /keys: hop until enough Keys, the end, or the budget.
        while (
            found.size <= limit &&
            hasMore &&
            failedNodes.length === 0 &&
            clock() - started < SCAN_BUDGET_MS
        ) {
            const r = await scanClusterNodes(
                pattern,
                cursors,
                SCAN_HOP_COUNT,
                id
            );
            r.keys.forEach((k) => found.add(k));
            ({ cursors, hasMore, failedNodes } = r);
        }
        const keys = [...found];
        return {
            keys: keys.slice(0, limit),
            truncated: keys.length > limit || hasMore,
            ...(failedNodes.length > 0 && { failedNodes: failedNodes.length })
        };
    }
};

// Keep a value small enough for an AI client's context. -> [value, truncated]
function truncate(value) {
    if (typeof value === 'string') {
        return [
            value.slice(0, MAX_VALUE_CHARS),
            value.length > MAX_VALUE_CHARS
        ];
    }
    if (Array.isArray(value)) {
        return [
            value.slice(0, MAX_VALUE_ITEMS),
            value.length > MAX_VALUE_ITEMS
        ];
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value);
        return [
            Object.fromEntries(entries.slice(0, MAX_VALUE_ITEMS)),
            entries.length > MAX_VALUE_ITEMS
        ];
    }
    return [value, false];
}

const getKey = {
    name: 'get_key',
    access: 'read',
    description: `Read one Key: type, TTL in seconds (-1 = no expiry), size ({ bytes, length }) and value. Strings are cut at ${MAX_VALUE_CHARS} characters and collections at ${MAX_VALUE_ITEMS} items; truncated: true says so.`,
    inputSchema: {
        connectionId,
        key: z.string().describe('Exact Key name')
    },
    run: async ({ connectionId: id, key }) => {
        const { type, ttl, value } = await readKey(id, key);
        const { memory, length } = await readMeta(id, key);
        const [shown, truncated] = truncate(value);
        return {
            key,
            type,
            ttl,
            size: { bytes: memory, length },
            // AI access "See values" off: no value, no truncation to report.
            ...(getAiAccess(id).values && { value: shown, truncated })
        };
    }
};

const getInfo = {
    name: 'get_info',
    access: 'read',
    description:
        'Redis INFO for a Connection, parsed into sections (server, clients, memory, stats, replication, keyspace, ...). Pass section to get only one.',
    inputSchema: {
        connectionId,
        section: z.string().optional().describe('e.g. memory')
    },
    run: async ({ connectionId: id, section }) => {
        const sections = parseRedisInfo(await execRedisCommand('INFO', id));
        if (!section) {
            return sections;
        }
        if (!(section in sections)) {
            throw new Error(`Unknown INFO section "${section}"`);
        }
        return { [section]: sections[section] };
    }
};

module.exports = [listConnections, scanKeys, getKey, getInfo];
