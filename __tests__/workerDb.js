// Isolate the SQLite config DB per jest worker so parallel suites don't
// delete each other's test connection.
process.env.REDIS_DECK_DB_FILE = `test-${process.env.JEST_WORKER_ID || 0}.sqlite`;
