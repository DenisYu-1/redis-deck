// Data version 5: the model behind the AI assistant. One row; absent until the
// user saves. The API key is stored here like the Connection passwords.
module.exports = function up(db) {
    db.exec(`
        CREATE TABLE ai_model (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            mode TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            api_key TEXT NOT NULL DEFAULT ''
        );
    `);
};
