// Model adapters (see turnRunner.js for the interface): by API key provider,
// and the Local model.
const anthropic = require('./anthropic');
const { openai, compatible, local } = require('./openai');

module.exports = {
    anthropic,
    openai,
    'openai-compatible': compatible,
    local
};
