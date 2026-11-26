// The MCP server of one assistant turn: the same registry AI clients use, under
// the assistant's name, with its tool-call limit. Transport-free, so every way
// of running a turn gets the same rules, rows and logging.
const { createMcpServer } = require('../mcp/server');
const { MAX_TOOL_CALLS, WRITES_UNAVAILABLE } = require('./limits');

const CLIENT_NAME = 'Redis Deck Assistant';

// onCall, onLimit: see mcp/callMeter.js.
function createAssistantServer({ onCall, onLimit }) {
    return createMcpServer({
        clientName: CLIENT_NAME,
        writesRefusal: WRITES_UNAVAILABLE,
        maxCalls: MAX_TOOL_CALLS,
        onCall,
        onLimit
    });
}

module.exports = { createAssistantServer };
