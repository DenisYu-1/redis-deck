// What both kinds of turn (turnRunner.js, agentTurn.js) start from.
const { getConnection, normalizeTier } = require('../database');
const { systemPrompt } = require('./systemPrompt');

// Throws for an unknown Connection.
function turnSystemPrompt(connectionId) {
    const { tier } = getConnection(connectionId);
    return systemPrompt({ id: connectionId, tier: normalizeTier(tier) });
}

// The assistant server's tool rows and approval cards, as events of the turn.
const toolEvents = (emit) => ({
    onCard: (card) => emit({ type: 'approval', ...card }),
    onCall: (call) => emit({ type: 'tool', ...call })
});

module.exports = { turnSystemPrompt, toolEvents };
