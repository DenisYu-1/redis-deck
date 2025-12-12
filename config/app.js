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
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(
        '/node_modules',
        express.static(path.join(__dirname, '..', 'node_modules'))
    );

    // API Routes
    app.use('/api', environmentRoutes);
    app.use('/api', keysRoutes);
    app.use('/api', infoRoutes);
    app.use('/api', connectionRoutes);
    app.use('/api/custom', customRoutes);
    app.use('/api/stats', statsRoutes);

    // Main HTML route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    return app;
}

module.exports = { createApp };
