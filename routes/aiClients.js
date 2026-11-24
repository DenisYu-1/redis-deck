// AI client (MCP) install routes. Desktop app only: config/app.js mounts this
// router only when given an installer (server embedded in Electron).
const express = require('express');

function createAiClientsRouter(installer) {
    const router = express.Router();

    const handle = (fn) => (req, res) => {
        try {
            res.json(fn(req));
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    };

    router.get(
        '/ai-clients',
        handle(() => ({
            clients: installer.list(),
            command: installer.commandLine()
        }))
    );
    router.get(
        '/ai-clients/:id/snippet',
        handle((req) => installer.snippet(req.params.id))
    );
    router.post(
        '/ai-clients/:id/install',
        handle((req) => {
            installer.install(req.params.id);
            return { status: installer.status(req.params.id) };
        })
    );
    router.post(
        '/ai-clients/:id/remove',
        handle((req) => {
            installer.remove(req.params.id);
            return { status: installer.status(req.params.id) };
        })
    );

    return router;
}

module.exports = { createAiClientsRouter };
