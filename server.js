const { createApp } = require('./config/app');
const { getAllConnections } = require('./services/database');
const statsCollector = require('./services/statsCollector');

const PORT = process.env.PORT || 3000;

const app = createApp();

const COLLECTION_INTERVAL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

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
}, COLLECTION_INTERVAL);

setInterval(() => {
    try {
        statsCollector.cleanupOldSnapshots(30);
    } catch (error) {
        console.error('Error cleaning up old snapshots:', error);
    }
}, CLEANUP_INTERVAL);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available Redis Connections:');

    const connections = getAllConnections();
    connections.forEach((conn) => {
        console.log(
            `- ${conn.id}: ${conn.host}:${conn.port}${conn.tls ? ' (TLS)' : ''}${conn.cluster ? ' (Cluster)' : ''}`
        );
    });

    console.log('\nConnections can be managed at: /api/connections');
    console.log('Custom Redis commands available at: /api/custom/execute');
    console.log('Statistics available at: /statistics.html');
    console.log(
        `Stats collection running every ${COLLECTION_INTERVAL / 60000} minutes`
    );
});
