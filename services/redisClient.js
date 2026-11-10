const { createClient } = require('redis');
const { getConnectionConfig } = require('./database');

// Persistent node-redis clients, one per saved connection, lazily opened and
// reused. Used only for hot loops (SCAN) where spawning a redis-cli process per
// call is the bottleneck. Everything else still goes through services/redis.js.
// ponytail: no pool, no eviction — a handful of long-lived sockets for a UI tool.
const clients = new Map(); // connectionId -> Promise<RedisClient>

function makeClient(cfg) {
    const client = createClient({
        username: cfg.username || undefined,
        password: cfg.password || undefined,
        database: cfg.db || undefined,
        socket: {
            host: cfg.host,
            port: Number(cfg.port),
            tls: cfg.tls ? true : undefined,
            rejectUnauthorized: cfg.tls ? cfg.verifyTls !== false : undefined, // mirrors redis-cli --insecure when verify is off
            connectTimeout: 10000,
            reconnectStrategy: (retries) => Math.min(retries * 200, 2000)
        }
    });
    client.on('error', (err) =>
        console.error(`redis client error:`, err.message)
    );
    return client;
}

async function getClient(connectionId) {
    const existing = clients.get(connectionId);
    if (existing) {
        try {
            const client = await existing;
            if (client.isOpen) {
                return client;
            }
        } catch {
            // fell over while connecting last time — rebuild below
        }
        clients.delete(connectionId);
    }

    const cfg = getConnectionConfig(connectionId);
    const client = makeClient(cfg);
    const connecting = client.connect().then(() => {
        // Don't let an idle client socket keep the process (or a test run) alive.
        if (typeof client.unref === 'function') {
            client.unref();
        }
        return client;
    });
    clients.set(connectionId, connecting);

    try {
        return await connecting;
    } catch (err) {
        clients.delete(connectionId);
        throw err;
    }
}

module.exports = { getClient };
