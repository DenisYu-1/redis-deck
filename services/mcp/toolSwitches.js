// Per-tool on/off switches: one global setting in SQLite. Read on every list
// and call, so a --mcp process applies a change without a restart.
const { getDatabase } = require('../database');
const tools = require('./tools');

const SETTING = 'mcp_tool_switches';
// run_workflow runs arbitrary Workflows, so it starts off.
const OFF_BY_DEFAULT = new Set(['run_workflow']);

function readOverrides() {
    const row = getDatabase()
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(SETTING);
    return row ? JSON.parse(row.value) : {};
}

const isToolEnabled = (name, overrides = readOverrides()) =>
    overrides[name] ?? !OFF_BY_DEFAULT.has(name);

const isKnownTool = (name) => tools.some((t) => t.name === name);

function listToolSwitches() {
    const overrides = readOverrides();
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        write: t.access === 'write',
        enabled: isToolEnabled(t.name, overrides)
    }));
}

function setToolEnabled(name, enabled) {
    if (!isKnownTool(name)) throw new Error(`Unknown tool '${name}'`);
    const value = JSON.stringify({ ...readOverrides(), [name]: enabled });
    getDatabase()
        .prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(SETTING, value);
}

module.exports = {
    isToolEnabled,
    isKnownTool,
    listToolSwitches,
    setToolEnabled
};
