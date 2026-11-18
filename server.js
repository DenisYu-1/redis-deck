const { createApp } = require('./config/app');
const { hostGuard } = require('./guards/hostGuard');
const { getAllConnections } = require('./services/database');
const { createInstaller } = require('./services/aiClients/installer');
const statsCollector = require('./services/statsCollector');
const { cleanupOldActivity } = require('./services/aiActivity');

const COLLECTION_INTERVAL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const SNAPSHOT_RETENTION_DAYS = 30;
const AI_ACTIVITY_RETENTION_DAYS = 30;

// Background loops; started once the server is listening. Timers are unref'd so
// they never keep the process alive on their own.
function startTimers() {
    const timers = [
        setInterval(async () => {
            try {
                console.log('Running scheduled stats collection...');
                const connections = getAllConnections();

                for (const conn of connections) {
                    try {
                        await statsCollector.collectSnapshot(conn.id);
                    } catch (error) {
                        console.error(
                            `Failed to collect stats for ${conn.id}:`,
                            error.message
                        );
                    }
                }
            } catch (error) {
                console.error('Error in stats collection interval:', error);
            }
        }, COLLECTION_INTERVAL),
        setInterval(() => {
            try {
                statsCollector.cleanupOldSnapshots(SNAPSHOT_RETENTION_DAYS);
            } catch (error) {
                console.error('Error cleaning up old snapshots:', error);
            }
            try {
                cleanupOldActivity(AI_ACTIVITY_RETENTION_DAYS);
            } catch (error) {
                console.error('Error cleaning up old AI activity:', error);
            }
        }, CLEANUP_INTERVAL)
    ];
    timers.forEach((t) => t.unref());
    return () => timers.forEach(clearInterval);
}

// Starts the app + background loops. Resolves with the listening http.Server;
// closing it also stops the loops. Electron main calls this with port 0 and
// embedded: true, which rejects requests with a foreign Host header (DNS rebinding),
// and mcpBinary ({ command, args } that start the app in --mcp mode), which
// enables the AI client installer routes.
function startServer({
    port = process.env.PORT || 3000,
    host,
    embedded = false,
    mcpBinary
} = {}) {
    let server;
    const app = createApp({
        middleware: embedded ? [hostGuard(() => server.address().port)] : [],
        aiClients:
            embedded && mcpBinary ? createInstaller(mcpBinary) : undefined
    });

    return new Promise((resolve, reject) => {
        let stopTimers = () => {};
        server = app.listen(port, host, () => {
            stopTimers = startTimers();
            console.log(
                `Server running on ${host || '0.0.0.0'}:${server.address().port}`
            );
            console.log('Available Redis Connections:');

            const connections = getAllConnections();
            connections.forEach((conn) => {
                console.log(
                    `- ${conn.id}: ${conn.host}:${conn.port}${conn.tls ? ' (TLS)' : ''}${conn.cluster ? ' (Cluster)' : ''}`
                );
            });

            console.log('\nConnections can be managed at: /api/connections');
            console.log('Statistics available at: /stats');
            console.log(
                `Stats collection running every ${COLLECTION_INTERVAL / 60000} minutes`
            );
            resolve(server);
        });
        server.on('close', () => stopTimers());
        server.on('error', (err) => {
            stopTimers();
            reject(err);
        });
    });
}

module.exports = { startServer };

if (require.main === module) {
    startServer().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
