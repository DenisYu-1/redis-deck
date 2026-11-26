// Rules of an assistant turn.
const MAX_TOOL_CALLS = 20;
// An approval card without an answer counts as Deny after this.
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

module.exports = { MAX_TOOL_CALLS, APPROVAL_TIMEOUT_MS };
