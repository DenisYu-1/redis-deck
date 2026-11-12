const { createApp } = require('./config/app');
const { hostGuard } = require('./guards/hostGuard');
const { getAllConnections } = require('./services/database');
const statsCollector = require('./services/statsCollector');

const COLLECTION_INTERVAL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

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
                statsCollector.cleanupOldSnapshots(30);
            } catch (error) {
                console.error('Error cleaning up old snapshots:', error);
            }
        }, CLEANUP_INTERVAL)
    ];
    timers.forEach((t) => t.unref());
    return () => timers.forEach(clearInterval);
}

// Starts the app + background loops. Resolves with the listening http.Server;
// closing it also stops the loops. Electron main calls this with port 0 and
// embedded: true, which rejects requests with a foreign Host header (DNS rebinding).
function startServer({
    port = process.env.PORT || 3000,
    host,
    embedded = false
} = {}) {
    let server;
    const app = createApp({
        middleware: embedded ? [hostGuard(() => server.address().port)] : []
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
