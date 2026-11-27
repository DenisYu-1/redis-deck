// Rules of an assistant turn.
const MAX_TOOL_CALLS = 20;
// An approval card without an answer counts as Deny after this.
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

// How long a tool call may take for whoever runs the tool loop: it may wait for
// the approval first.
const AGENT_CALL_TIMEOUT_MS = 2 * APPROVAL_TIMEOUT_MS;

module.exports = {
    MAX_TOOL_CALLS,
    APPROVAL_TIMEOUT_MS,
    AGENT_CALL_TIMEOUT_MS
};
