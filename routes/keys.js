const express = require('express');
const router = express.Router();
const { execRedisCommand, scanClusterNodes } = require('../services/redis');
const keyStore = require('../services/keyStore');
const {
    pageMeta,
    matchesTtl,
    TYPES,
    TTL_FILTERS
} = require('../services/keyMeta');

const fail = (res, error) =>
    res
        .status(error.status || 500)
        .json(error instanceof Error ? { error: error.message } : error);

// Search keys by pattern with pagination using SCAN
router.get('/keys', async (req, res) => {
    try {
        const env = req.query.env;
        const pattern = req.query.pattern || '*';
        const count = parseInt(req.query.count) || 50;
        const type = req.query.type || null;
        const ttlFilter = req.query.ttl || 'any';
        if (type && !TYPES.includes(type)) {
            return res.status(400).json({ error: `Unknown type "${type}"` });
        }
        if (!TTL_FILTERS.includes(ttlFilter)) {
            return res
                .status(400)
                .json({ error: `Unknown ttl filter "${ttlFilter}"` });
        }
        const started = Date.now();
        const meta = {};
        let returned = 0;

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
        // Bounded so proving "no match" over a huge keyspace can't hang the
        // request. When we stop early, hasMore stays true and Load More resumes
        // from the cursor. ponytail: raise MAX_ITERATIONS or add a real key
        // index if bounded deep search isn't good enough.
        const MAX_ITERATIONS = 60;

        // Auto-pagination loop - keep scanning until we have a full page of keys
        // or run out. Each iteration is one socket round-trip (not a process).
        // COUNT starts small so a broad pattern fills the page in one cheap hop,
        // then ramps up so a selective pattern sweeps the keyspace in few hops.
        do {
            const scanCount = iterations < 3 ? Math.max(count, 500) : 20000;
            const result = await scanClusterNodes(
                pattern,
                nextCursors,
                scanCount,
                env,
                type
            );

            // SCAN may repeat a key across calls; metadata is per page.
            const fresh = [...new Set(result.keys)];
            returned += fresh.length;
            const pageKeys = await pageMeta(env, fresh);
            const kept = fresh.filter((k) => {
                meta[k] = pageKeys[k];
                return matchesTtl(ttlFilter, pageKeys[k].ttl);
            });
            keys = keys.concat(kept);
            nextCursors = result.cursors;
            hasMore = result.hasMore;
            iterations++;
        } while (keys.length < count && hasMore && iterations < MAX_ITERATIONS);

        // No trimming: return everything the sweep found so the cursor we hand
        // back lines up exactly with these keys (Load More must not skip any).
        res.json({
            keys,
            cursors: nextCursors, // Array of cursors (one for each node)
            hasMore,
            total: keys.length + (hasMore ? '?' : 0),
            meta: Object.fromEntries(keys.map((k) => [k, meta[k]])),
            scan: {
                iterations,
                returned,
                matched: keys.length,
                ms: Date.now() - started
            }
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

// Get value for a key. value shape depends on type: string -> string,
// hash -> {field: value}, list/set -> string[], zset -> [{member, score}],
// stream -> [{id, fields}].
router.get('/keys/:key', async (req, res) => {
    try {
        res.json(await keyStore.readKey(req.query.env, req.params.key));
    } catch (error) {
        if (error.code === 'KEY_NOT_FOUND') {
            return res.status(404).json({
                error: 'Key not found',
                message:
                    'This key was found in search results but does not actually exist (ghost key)',
                key: req.params.key
            });
        }
        console.error(`Error retrieving key ${req.params.key}:`, error);
        fail(res, error);
    }
});

// Check if a key exists
router.get('/keys/:key/exists', async (req, res) => {
    try {
        res.json({
            exists: await keyStore.keyExists(req.query.env, req.params.key)
        });
    } catch (error) {
        console.error('Error checking key existence:', error);
        fail(res, error);
    }
});

// Create/replace a key. type defaults to string; value shape as in GET.
router.post('/keys', async (req, res) => {
    try {
        const env = req.query.env;
        const { key, value, expiry, type = 'string' } = req.body;

        if (!key || value === undefined) {
            return res
                .status(400)
                .json({ error: 'Key and value are required' });
        }

        await keyStore.writeKey(env, key, type, value, parseInt(expiry) || 0);
        res.json({
            result: 'OK',
            key,
            success: true,
            valueLength: JSON.stringify(value).length
        });
    } catch (error) {
        console.error('Error setting key:', error);
        fail(res, error);
    }
});

// Delete a key
router.delete('/keys/:key', async (req, res) => {
    try {
        const count = await keyStore.deleteKey(req.query.env, req.params.key);
        res.json({ deleted: count > 0, count, key: req.params.key });
    } catch (error) {
        console.error(`Error deleting key ${req.params.key}:`, error);
        fail(res, error);
    }
});

// Delete keys by pattern
router.delete('/allkeys', async (req, res) => {
    try {
        const env = req.query.env;
        const pattern = req.query.pattern;

        if (!pattern) {
            return res
                .status(400)
                .json({ error: 'Pattern parameter is required' });
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
            return res.json({
                count: 0,
                message: 'No keys found matching the pattern'
            });
        }

        let deletedCount = 0;
        for (const key of keys) {
            try {
                deletedCount += (await keyStore.deleteKey(env, key)) || 0;
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

// P1.9: 10s per-process DBSIZE cache. ponytail: plain Map, not shared across workers.
const keycountCache = new Map();
const KEYCOUNT_TTL_MS = 10000;

// Get total number of keys in database
router.get('/keycount', async (req, res) => {
    try {
        const env = req.query.env;
        const hit = keycountCache.get(env);
        if (hit && Date.now() - hit.at < KEYCOUNT_TTL_MS) {
            return res.json({ count: hit.count });
        }
        const result = await execRedisCommand('DBSIZE', env);
        const keyCount = parseInt(result) || 0;
        keycountCache.set(env, { at: Date.now(), count: keyCount });
        res.json({ count: keyCount });
    } catch (error) {
        console.error('Error getting key count:', error);
        res.status(500).json(error);
    }
});

// Rename a key
router.post('/keys/:key/rename', async (req, res) => {
    try {
        const { newKey } = req.body;
        if (!newKey) {
            return res.status(400).json({ error: 'New key name is required' });
        }
        const result = await keyStore.renameKey(
            req.query.env,
            req.params.key,
            newKey
        );
        res.json({ result, oldKey: req.params.key, newKey });
    } catch (error) {
        fail(res, error);
    }
});

// Set expiry on a key (negative seconds removes it)
router.post('/keys/:key/expire', async (req, res) => {
    try {
        const { seconds } = req.body;
        if (seconds === undefined) {
            return res
                .status(400)
                .json({ error: 'Expiry seconds are required' });
        }
        const result = await keyStore.expireKey(
            req.query.env,
            req.params.key,
            parseInt(seconds)
        );
        res.json({ result, key: req.params.key, ttl: parseInt(seconds) });
    } catch (error) {
        fail(res, error);
    }
});

// Copy a key, optionally to another environment
router.post('/keys/:key/copy', async (req, res) => {
    try {
        const env = req.query.env;
        const key = req.params.key;
        const { targetKey, targetEnv } = req.body;
        if (!targetKey) {
            return res
                .status(400)
                .json({ error: 'Target key name is required' });
        }
        const targetEnvironment = targetEnv || env;
        await keyStore.copyKey(env, key, targetEnvironment, targetKey);
        res.json({
            result: 'Key copied successfully',
            sourceKey: key,
            targetKey,
            targetEnv: targetEnvironment
        });
    } catch (error) {
        console.error('Error copying key:', error);
        fail(res, error);
    }
});

// Replace a sorted set. members: [{ value, score }] (kept for older clients;
// POST /keys with type "zset" and [{member, score}] does the same).
router.post('/keys/:key/zadd', async (req, res) => {
    try {
        const key = req.params.key;
        const { members, expiry } = req.body;
        if (!Array.isArray(members) || members.length === 0) {
            return res
                .status(400)
                .json({ error: 'Key and members array are required' });
        }
        if (
            members.some(
                (m) => typeof m.score !== 'number' || m.value === undefined
            )
        ) {
            return res.status(400).json({
                error: 'Each member must have score (number) and value properties'
            });
        }
        await keyStore.writeKey(
            req.query.env,
            key,
            'zset',
            members.map((m) => ({ member: m.value, score: m.score })),
            parseInt(expiry) || 0
        );
        res.json({
            result: String(members.length),
            key,
            success: true,
            membersAdded: members.length
        });
    } catch (error) {
        console.error('Error adding to ZSET:', error);
        fail(res, error);
    }
});

module.exports = router;
