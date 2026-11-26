// Model settings of the AI assistant. App settings, not Redis writes, so the
// write guard is not involved. No response carries the API key.
const express = require('express');
const {
    getModelSettings,
    saveModelSettings,
    testModelSettings
} = require('../services/aiModel');

const router = express.Router();

router.get('/ai-model', (req, res) => {
    res.json(getModelSettings());
});

router.put('/ai-model', (req, res) => {
    try {
        res.json(saveModelSettings(req.body));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai-model/test', async (req, res) => {
    try {
        res.json(await testModelSettings(req.body));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
