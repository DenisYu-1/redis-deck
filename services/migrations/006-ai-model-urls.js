// Data version 6: OpenAI-compatible and Local model. base_url belongs to the
// stored API key (it is only ever sent there); the Local model keeps its own
// URL and model, so choosing it leaves the API key settings as they are.
module.exports = function up(db) {
    db.exec(`
        ALTER TABLE ai_model ADD COLUMN base_url TEXT NOT NULL DEFAULT '';
        ALTER TABLE ai_model ADD COLUMN local_url TEXT NOT NULL DEFAULT '';
        ALTER TABLE ai_model ADD COLUMN local_model TEXT NOT NULL DEFAULT '';
    `);
};
