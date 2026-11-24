// AI access grid routes (ADR 0005). App settings for AI clients, not Redis
// writes, so the write guard is not involved.
const express = require('express');
const {
    listAiAccess,
    setAiAccess,
    AiAccessError
} = require('../services/aiAccess');

const router = express.Router();

router.get('/ai-access', (req, res) => {
    res.json({ connections: listAiAccess() });
});

router.put('/ai-access/:id', (req, res) => {
    try {
        res.json(setAiAccess(req.params.id, req.body ?? {}));
    } catch (error) {
        if (!(error instanceof AiAccessError)) throw error;
        res.status(error.status).json({ error: error.message });
    }
});

module.exports = router;
