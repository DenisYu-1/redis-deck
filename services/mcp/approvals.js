// User approval for MCP writes on Confirm writes Connections, plus the
// "Allow for this session" grants. One instance per MCP server, so grants
// live in memory for the --mcp process and die with it.
//
// approver(request) -> 'deny' | 'once' | 'session'. Anything else, a throw,
// or no answer within timeoutMs counts as 'deny'.
const SESSION_GRANT_MS = 60 * 60 * 1000;
const APPROVAL_TIMEOUT_MS = 60 * 1000;

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve('deny'), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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

    // request: { clientName, connectionId, tier, operation, key }.
    // Resolves true when the write may run.
    async function approve(request) {
        if (hasGrant(request.connectionId)) {
            return true;
        }
        let answer;
        try {
            answer = await withTimeout(
                Promise.resolve(approver(request)),
                timeoutMs
            );
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

module.exports = { createApprovals, SESSION_GRANT_MS, APPROVAL_TIMEOUT_MS };
