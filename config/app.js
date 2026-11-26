const express = require('express');
const path = require('path');

// Routes
const environmentRoutes = require('../routes/environment');
const keysRoutes = require('../routes/keys');
const infoRoutes = require('../routes/info');
const connectionRoutes = require('../routes/connections');
const searchRoutes = require('../routes/searches');
const statsRoutes = require('../routes/stats');
const workflowRoutes = require('../routes/workflows');
const jobRoutes = require('../routes/jobs');
const { createAiClientsRouter } = require('../routes/aiClients');
const aiActivityRoutes = require('../routes/aiActivity');
const aiToolsRoutes = require('../routes/aiTools');
const aiHiddenFieldsRoutes = require('../routes/aiHiddenFields');
const aiAccessRoutes = require('../routes/aiAccess');
const consoleRoutes = require('../routes/console');
const aiModelRoutes = require('../routes/aiModel');
const aiChatRoutes = require('../routes/aiChat');

// aiClients: client config installer; given only when embedded in the
// Desktop app, which is the only place the installer routes exist.
function createApp({ middleware = [], searchBudgetMs, aiClients } = {}) {
    const app = express();
    // Tests shrink the GET /api/keys time budget instead of waiting 2 s.
    if (searchBudgetMs !== undefined)
        app.locals.searchBudgetMs = searchBudgetMs;

    // Optional leading middleware (e.g. the embedded-server Host guard)
    middleware.forEach((m) => app.use(m));

    // Middleware
    // The AI chat sends its whole transcript, so it gets a larger body limit;
    // this parser must come first.
    app.use('/api/ai-chat', express.json({ limit: '4mb' }));
    app.use(express.json());

    // Serve static files from public directory (CSS, etc.)
    app.use('/public', express.static(path.join(__dirname, '..', 'public')));

    // Serve built React app from dist in production
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    // API Routes
    app.use('/api', environmentRoutes);
    app.use('/api', keysRoutes);
    app.use('/api', infoRoutes);
    app.use('/api', connectionRoutes);
    app.use('/api', searchRoutes);
    app.use('/api', workflowRoutes);
    app.use('/api', jobRoutes);
    app.use('/api', aiActivityRoutes);
    app.use('/api', aiToolsRoutes);
    app.use('/api', aiHiddenFieldsRoutes);
    app.use('/api', aiAccessRoutes);
    app.use('/api', consoleRoutes);
    app.use('/api', aiModelRoutes);
    app.use('/api', aiChatRoutes);
    app.use('/api/stats', statsRoutes);
    if (aiClients) app.use('/api', createAiClientsRouter(aiClients));

    // SPA fallback routes
    app.get('/', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    // React Router fallback - serve index.html for all routes
    app.get('*splat', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    return app;
}

module.exports = { createApp };
