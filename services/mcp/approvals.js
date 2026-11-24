// User approval for MCP writes on Confirm writes Connections, plus the
// "Allow for this session" grants. One instance per MCP server, so grants
// live in memory for the --mcp process and die with it.
//
// approver(request, { signal }) -> 'deny' | 'once' | 'session'. Anything
// else, a throw, or no answer within timeoutMs counts as 'deny'; signal
// aborts at that timeout so the approver can close its prompt.
const SESSION_GRANT_MS = 60 * 60 * 1000;
const APPROVAL_TIMEOUT_MS = 60 * 1000;

// Asks the approver; 'deny' once ms pass without an answer.
function askWithTimeout(approver, request, ms) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
            controller.abort();
            resolve('deny');
        }, ms);
    });
    const answer = Promise.resolve().then(() =>
        approver(request, { signal: controller.signal })
    );
    return Promise.race([answer, timeout]).finally(() => clearTimeout(timer));
}

function createApprovals({ approver, clock, timeoutMs = APPROVAL_TIMEOUT_MS }) {
    // Connection id -> time the session grant was given.
    const grants = new Map();

    function hasGrant(connectionId) {
        const grantedAt = grants.get(connectionId);
        if (grantedAt === undefined) {
            return false;
        }
        if (clock() - grantedAt >= SESSION_GRANT_MS) {
            grants.delete(connectionId);
            return false;
        }
        return true;
    }

    // request: { clientName, connectionId, tier, operation, target,
    // targetLabel }.
    // Resolves true when the write may run.
    async function approve(request) {
        if (hasGrant(request.connectionId)) {
            return true;
        }
        let answer;
        try {
            answer = await askWithTimeout(approver, request, timeoutMs);
        } catch {
            answer = 'deny';
        }
        if (answer === 'session') {
            grants.set(request.connectionId, clock());
        }
        return answer === 'once' || answer === 'session';
    }

    return { approve };
}

module.exports = { createApprovals, SESSION_GRANT_MS };
