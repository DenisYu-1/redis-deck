// AI activity log and the "Log AI operations" toggle. App settings, not Redis
// writes, so the write guard is not involved.
const express = require('express');
const {
    RESULTS,
    listActivity,
    listClients,
    clearActivity,
    isLoggingEnabled,
    setLoggingEnabled
} = require('../services/aiActivity');

const MAX_LIMIT = 200;

const router = express.Router();

// Integer query param in [min, max], or the fallback when absent; null if bad.
function intParam(raw, fallback, min, max) {
    if (raw === undefined) return fallback;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

router.get('/ai-activity', (req, res) => {
    const limit = intParam(req.query.limit, 50, 1, MAX_LIMIT);
    const offset = intParam(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    if (limit === null || offset === null) {
        return res.status(400).json({
            error: `limit must be 1-${MAX_LIMIT} and offset a non-negative integer`
        });
    }
    const result = req.query.status || undefined;
    if (result && !Object.hasOwn(RESULTS, result)) {
        return res.status(400).json({ error: 'unknown status' });
    }
    res.json(
        listActivity({
            connectionId: req.query.connectionId || undefined,
            client: req.query.client || undefined,
            q: req.query.q || undefined,
            result,
            limit,
            offset
        })
    );
});

router.get('/ai-activity/clients', (req, res) => {
    res.json({ clients: listClients() });
});

router.delete('/ai-activity', (req, res) => {
    res.json({ removed: clearActivity() });
});

router.get('/ai-activity/settings', (req, res) => {
    res.json({ logEnabled: isLoggingEnabled() });
});

router.put('/ai-activity/settings', (req, res) => {
    const { logEnabled } = req.body ?? {};
    if (typeof logEnabled !== 'boolean') {
        return res.status(400).json({ error: 'logEnabled must be a boolean' });
    }
    setLoggingEnabled(logEnabled);
    res.json({ logEnabled: isLoggingEnabled() });
});

module.exports = router;
