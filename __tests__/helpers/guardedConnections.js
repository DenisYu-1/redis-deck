// Guarded test Connections (Read-only / Confirm writes) that point at the same
// test Redis as global.TEST_CONNECTION_ID, so writes can be checked there.
const { db } = require('../../services/database');

function addGuardedConnection(id, flags) {
    const base = db
        .prepare('SELECT * FROM connections WHERE id = ?')
        .get(global.TEST_CONNECTION_ID);
    db.prepare(
        `INSERT OR REPLACE INTO connections (id, host, port, username, password, tls, cluster, \`order\`, db, tier, read_only, confirm_writes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1000, ?, 'production', ?, ?)`
    ).run(
        id,
        base.host,
        base.port,
        base.username,
        base.password,
        base.tls,
        base.cluster,
        base.db,
        flags.readOnly ? 1 : 0,
        flags.confirmWrites ? 1 : 0
    );
}

function removeConnections(...ids) {
    for (const id of ids) {
        db.prepare('DELETE FROM connections WHERE id = ?').run(id);
    }
}

module.exports = { addGuardedConnection, removeConnections };
