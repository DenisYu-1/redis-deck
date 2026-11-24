// Data version 3: AI access, one row per Connection (ADR 0005). Existing
// Connections get the Tier defaults. Self-contained: a migration never calls
// app code that may change later.
module.exports = function up(db) {
    db.exec(`
        CREATE TABLE ai_access (
            connection_id TEXT PRIMARY KEY,
            see_keys INTEGER NOT NULL DEFAULT 1,
            see_values INTEGER NOT NULL DEFAULT 1,
            write INTEGER NOT NULL DEFAULT 0,
            workflows INTEGER NOT NULL DEFAULT 0,
            ask INTEGER NOT NULL DEFAULT 1
        );

        INSERT INTO ai_access (connection_id, see_keys, see_values, write, workflows, ask)
        SELECT id,
               1,
               CASE WHEN tier = 'production' THEN 0 ELSE 1 END,
               CASE WHEN tier = 'production' OR tier = 'staging' OR read_only = 1 THEN 0 ELSE 1 END,
               CASE WHEN tier = 'production' OR tier = 'staging' OR read_only = 1 THEN 0 ELSE 1 END,
               CASE WHEN tier = 'local' THEN 0 ELSE 1 END
        FROM connections;
    `);
};
