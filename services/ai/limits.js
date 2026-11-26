// Rules of an assistant turn, shared by the system prompt and the MCP server.
const MAX_TOOL_CALLS = 20;
// Until the chat has approval cards, no write of the assistant runs.
const WRITES_UNAVAILABLE =
    'Writes from the AI assistant are not available yet, so every write call is refused.';

module.exports = { MAX_TOOL_CALLS, WRITES_UNAVAILABLE };
