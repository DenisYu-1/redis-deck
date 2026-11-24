// Hidden fields setting for AI clients. App settings, not Redis writes, so the
// write guard is not involved.
const express = require('express');
const {
    getHiddenFields,
    setHiddenFields
} = require('../services/hiddenFields');

const router = express.Router();

router.get('/ai-hidden-fields', (req, res) => {
    res.json({ fields: getHiddenFields() });
});

router.put('/ai-hidden-fields', (req, res) => {
    try {
        res.json({ fields: setHiddenFields(req.body?.fields) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
