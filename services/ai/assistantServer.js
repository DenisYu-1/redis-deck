// The MCP server of one assistant turn: the same registry AI clients use, under
// the assistant's name, with its tool-call limit and the chat's approval cards
// as the approver. Transport-free, so every way of running a turn gets the same
// rules, rows, cards and logging.
const { createMcpServer } = require('../mcp/server');
const { cardOf } = require('../mcp/writeGate');
const { awaitAnswer } = require('./approvalDesk');
const { MAX_TOOL_CALLS, APPROVAL_TIMEOUT_MS } = require('./limits');

const CLIENT_NAME = 'Redis Deck Assistant';

// chatId: whose answers count (approvalDesk.js). signal: aborting it denies
// what still waits. onCard gets every approval card, then its new state
// (mcp/writeGate.js, plus state 'pending'). onCall, onLimit: mcp/callMeter.js.
function createAssistantServer({ chatId, signal, onCall, onCard, onLimit }) {
    // Never 'session': the next write asks again.
    const approver = (request, { signal: timedOut }) => {
        const signals = [timedOut, signal];
        const answer = awaitAnswer({ chatId, id: request.id }, signals);
        onCard({ ...cardOf(request), state: 'pending' });
        return answer;
    };
    return createMcpServer({
        clientName: CLIENT_NAME,
        approver,
        approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
        onWrite: onCard,
        maxCalls: MAX_TOOL_CALLS,
        onCall,
        onLimit
    });
}

module.exports = { createAssistantServer };
