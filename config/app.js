const express = require('express');
const path = require('path');

// Routes
const environmentRoutes = require('../routes/environment');
const keysRoutes = require('../routes/keys');
const infoRoutes = require('../routes/info');
const customRoutes = require('../routes/custom');
const connectionRoutes = require('../routes/connections');
const statsRoutes = require('../routes/stats');

function createApp() {
    const app = express();

    // Middleware
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
    app.use('/api/custom', customRoutes);
    app.use('/api/stats', statsRoutes);

    // SPA fallback routes
    app.get('/', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    // React Router fallback - serve index.html for all routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    return app;
}

module.exports = { createApp };
