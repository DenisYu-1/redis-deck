// Data version 7: the Local agent. agent is the chosen one; agents holds each
// agent's own fields as JSON, { <id>: { path, args } }, '' meaning the default.
module.exports = function up(db) {
    db.exec(`
        ALTER TABLE ai_model ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude';
        ALTER TABLE ai_model ADD COLUMN agents TEXT NOT NULL DEFAULT '{}';
    `);
};
