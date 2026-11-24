// MCP tool switches (which tools AI clients may see and call). App settings,
// not Redis writes, so the write guard is not involved.
const express = require('express');
const {
    listToolSwitches,
    isKnownTool,
    setToolEnabled
} = require('../services/mcp/toolSwitches');

const router = express.Router();

router.get('/ai-tools', (req, res) => {
    res.json({ tools: listToolSwitches() });
});

router.put('/ai-tools/:name', (req, res) => {
    const { name } = req.params;
    if (!isKnownTool(name)) {
        return res.status(404).json({ error: `Unknown tool '${name}'` });
    }
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    setToolEnabled(name, enabled);
    res.json({ tools: listToolSwitches() });
});

module.exports = router;
