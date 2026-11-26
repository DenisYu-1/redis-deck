// The Console page: typed Redis commands from a fixed allowed list (ADR 0006).
// Commands are never logged here.
const express = require('express');
const { getConnection } = require('../services/database');
const { tokenize } = require('../services/redis');
const { checkWrite } = require('../guards/writeGuard');
const { COMMANDS, lookupCommand } = require('../services/console/commands');
const { runStatements } = require('../services/console/run');

const router = express.Router();

const isStatement = (s) =>
    Number.isInteger(s?.line) &&
    typeof s.text === 'string' &&
    tokenize(s.text).length > 0;

const isWrite = ({ text }) =>
    lookupCommand(tokenize(text)).entry?.access === 'write';

router.get('/console/commands', (req, res) => {
    res.json({ commands: COMMANDS });
});

router.post('/console/run', async (req, res) => {
    const { env } = req.query;
    if (!getConnection(env)) {
        return res.status(404).json({ error: `Connection '${env}' not found` });
    }
    const statements = req.body?.statements;
    if (
        !Array.isArray(statements) ||
        statements.length === 0 ||
        !statements.every(isStatement)
    ) {
        return res.status(400).json({
            error: 'statements must be a list of { line, text } with a command'
        });
    }
    // once for the whole batch, before anything runs; the refusal names the
    // writes so the page can list them when it asks for confirmation
    const writes = statements.filter(isWrite);
    const refusal = writes.length > 0 && checkWrite(env, req.headers);
    if (refusal) {
        return res.status(refusal.status).json({
            error: refusal.error,
            code: refusal.status,
            writes: writes.map(({ line, text }) => ({ line, text }))
        });
    }
    res.json({ results: await runStatements(env, statements) });
});

module.exports = router;
