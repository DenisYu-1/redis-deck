const { createApp } = require('./config/app');
const { getAllConnections } = require('./services/database');
const statsCollector = require('./services/statsCollector');

// Starts the app + background loops. Resolves with the listening http.Server;
// closing it also stops the loops. Electron main calls this with port 0.
function startServer({ port = process.env.PORT || 3000, host } = {}) {
    const app = createApp();
    const timers = [];
    const COLLECTION_INTERVAL = 5 * 60 * 1000;
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

    timers.push(
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
        }, COLLECTION_INTERVAL)
    );

    timers.push(
        setInterval(() => {
            try {
                statsCollector.cleanupOldSnapshots(30);
            } catch (error) {
                console.error('Error cleaning up old snapshots:', error);
            }
        }, CLEANUP_INTERVAL)
    );

    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
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
        });
        server.on('close', () => timers.forEach(clearInterval));
        server.on('error', reject);
        server.once('listening', () => resolve(server));
    });
}

module.exports = { startServer };

if (require.main === module) {
    startServer().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
