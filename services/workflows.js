// Workflow registry: manifests come from the plugin config (same files the
// frontend merges), handlers from services/workflows/<pluginId>/<actionId>.js
// or the gitignored services/workflows/extensions/<pluginId>/<actionId>.js.
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./database');
const { execRedisCommand } = require('./redis');

const CONFIG_DIR = path.join(__dirname, '..', 'client', 'plugins', 'config');
const HANDLER_DIRS = [
    path.join(__dirname, 'workflows'),
    path.join(__dirname, 'workflows', 'extensions')
];
const ID_RE = /^[A-Za-z0-9_-]+$/;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_LIMIT = 50;

class WorkflowError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function readConfig(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8'));
    } catch {
        return { plugins: [] };
    }
}

// Same merge as the frontend: by plugin id, override wins.
function loadPlugins() {
    const merged = new Map();
    for (const file of ['config.json', 'config.override.json']) {
        for (const p of readConfig(file).plugins ?? []) {
            merged.set(p.id, { ...merged.get(p.id), ...p });
        }
    }
    return [...merged.values()].filter((p) => p.enabled !== false);
}

function loadHandler(pluginId, actionId) {
    if (!ID_RE.test(pluginId) || !ID_RE.test(actionId)) {
        return null;
    }
    for (const dir of HANDLER_DIRS) {
        const file = path.join(dir, pluginId, `${actionId}.js`);
        if (fs.existsSync(file)) {
            return require(file);
        }
    }
    return null;
}

// Plugins that define actions with a handler on disk, for GET /api/workflows.
function listWorkflows() {
    return loadPlugins()
        .map((p) => ({
            id: p.id,
            name: p.name,
            actions: (p.actions ?? [])
                .filter((a) => loadHandler(p.id, a.id))
                .map((a) => ({
                    ...a,
                    writes: Boolean(a.writes),
                    inputs: a.inputs ?? [],
                    fullId: `${p.id}.${a.id}`
                }))
        }))
        .filter((p) => p.actions.length > 0);
}

function findWorkflow(fullId) {
    const [pluginId, actionId, ...rest] = String(fullId).split('.');
    if (!pluginId || !actionId || rest.length) {
        return null;
    }
    const action = listWorkflows()
        .find((p) => p.id === pluginId)
        ?.actions.find((a) => a.id === actionId);
    return action ? { action, handler: loadHandler(pluginId, actionId) } : null;
}

// Validate raw form values against the manifest; returns typed values with
// defaults applied or throws WorkflowError(400).
function validateInputs(action, raw = {}) {
    const out = {};
    for (const input of action.inputs) {
        const label = input.label || input.name;
        let v = raw[input.name];
        if (v === undefined || v === null || v === '') {
            v = input.def;
        }
        if (v === undefined || v === null || v === '') {
            if (input.required) {
                throw new WorkflowError(400, `${label} is required`);
            }
            continue;
        }
        v = String(v).trim();
        if (input.type === 'int') {
            if (!/^-?\d+$/.test(v)) {
                throw new WorkflowError(400, `${label} must be an integer`);
            }
            v = Number(v);
        } else if (input.type === 'uuid') {
            if (!UUID_RE.test(v)) {
                throw new WorkflowError(400, `${label} must be a valid UUID`);
            }
        } else if (input.type === 'select') {
            const options = (input.options ?? []).map((o) =>
                String(o.value ?? o)
            );
            if (!options.includes(v)) {
                throw new WorkflowError(
                    400,
                    `${label} must be one of: ${options.join(', ')}`
                );
            }
        }
        out[input.name] = v;
    }
    return out;
}

function makeContext(env, tier) {
    return {
        env,
        tier,
        exec: (command) => execRedisCommand(command, env)
    };
}

async function plan(workflow, env, rawInputs, connection) {
    const inputs = validateInputs(workflow.action, rawInputs);
    const result = await workflow.handler.plan(
        inputs,
        makeContext(env, connection.tier)
    );
    return { inputs, ...result };
}

async function run(workflow, env, rawInputs, connection) {
    const inputs = validateInputs(workflow.action, rawInputs);
    const tier = connection.tier || 'local';
    let ok = true;
    let text;
    try {
        ({ text } = await workflow.handler.run(inputs, makeContext(env, tier)));
    } catch (error) {
        ok = false;
        text = error?.message ?? String(error);
    }
    getDatabase()
        .prepare(
            `INSERT INTO workflow_runs (action_id, connection_id, tier, inputs, ok, text, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            workflow.action.fullId,
            env,
            tier,
            JSON.stringify(inputs),
            ok ? 1 : 0,
            String(text ?? ''),
            Date.now()
        );
    return { ok, text, inputs };
}

function getHistory(fullId) {
    return getDatabase()
        .prepare(
            'SELECT id, connection_id, tier, inputs, ok, text, created_at FROM workflow_runs WHERE action_id = ? ORDER BY id DESC LIMIT ?'
        )
        .all(fullId, HISTORY_LIMIT)
        .map((r) => ({
            id: r.id,
            connection: r.connection_id,
            tier: r.tier,
            inputs: JSON.parse(r.inputs),
            ok: r.ok === 1,
            text: r.text,
            at: r.created_at
        }));
}

module.exports = {
    WorkflowError,
    listWorkflows,
    findWorkflow,
    validateInputs,
    plan,
    run,
    getHistory
};
