const express = require('express');
const router = express.Router();
const { getConnection } = require('../services/database');
const workflows = require('../services/workflows');
const { writeGuard } = require('../guards/writeGuard');

const envOf = (req) => req.body?.env ?? req.query.env;

// Resolves :id and the connection, or answers 400/404 itself.
function resolveWorkflow(req, res, next) {
    const workflow = workflows.findWorkflow(req.params.id);
    if (!workflow) {
        return res.status(404).json({ error: 'Unknown workflow' });
    }
    req.workflow = workflow;
    if (req.method === 'GET') {
        return next();
    }
    const env = envOf(req);
    if (!env) {
        return res.status(400).json({ error: 'env is required' });
    }
    req.connection = getConnection(env);
    if (!req.connection) {
        return res.status(404).json({ error: `Connection '${env}' not found` });
    }
    next();
}

function handle(fn) {
    return async (req, res) => {
        try {
            res.json(await fn(req));
        } catch (error) {
            if (error instanceof workflows.WorkflowError) {
                return res.status(error.status).json({ error: error.message });
            }
            console.error('Workflow error:', error);
            res.status(500).json({ error: error?.message ?? String(error) });
        }
    };
}

router.get('/workflows', (req, res) => {
    res.json({ plugins: workflows.listWorkflows() });
});

router.get(
    '/workflows/:id/history',
    resolveWorkflow,
    handle((req) => ({ runs: workflows.getHistory(req.params.id) }))
);

// A dry run writes nothing, so it is not guarded.
router.post(
    '/workflows/:id/plan',
    resolveWorkflow,
    handle(async (req) => ({
        plan: await workflows.plan(
            req.workflow,
            envOf(req),
            req.body?.inputs,
            req.connection
        )
    }))
);

router.post(
    '/workflows/:id/run',
    resolveWorkflow,
    writeGuard((req) => (req.workflow.action.writes ? [envOf(req)] : [])),
    handle(async (req) => ({
        result: await workflows.run(
            req.workflow,
            envOf(req),
            req.body?.inputs,
            req.connection
        )
    }))
);

module.exports = router;
