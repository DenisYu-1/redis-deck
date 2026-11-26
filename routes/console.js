// The Console page: typed Redis commands from a fixed allowed list (ADR 0006).
// Commands are never logged here.
const express = require('express');
const { getConnection } = require('../services/database');
const { tokenize } = require('../services/redis');
const { COMMANDS } = require('../services/console/commands');
const { runStatements } = require('../services/console/run');

const router = express.Router();

const isStatement = (s) =>
    Number.isInteger(s?.line) &&
    typeof s.text === 'string' &&
    tokenize(s.text).length > 0;

router.get('/console/commands', (req, res) => {
    res.json({ commands: COMMANDS });
});

router.post('/console/run', async (req, res) => {
    const { env } = req.query;
    const connection = getConnection(env);
    if (!connection) {
        return res.status(404).json({ error: `Connection '${env}' not found` });
    }
    if (connection.cluster) {
        return res.status(400).json({
            error: 'The Console does not support clustered Connections yet'
        });
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
    res.json({ results: await runStatements(env, statements) });
});

module.exports = router;
