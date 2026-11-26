// The agent CLIs a turn can run on. One entry each:
//   id, name, command
//   defaultArgs    the Arguments field's default; {mcp_config} stands for the
//                  path of the file with mcpConfig
//   prepare({ url, token, system, prompt }) -> how one turn reaches the
//                  endpoint at url: { mcpConfig (file text), args (appended),
//                  env, stdin }
const { AGENT_CALL_TIMEOUT_MS } = require('./limits');

const SERVER_NAME = 'redis-deck';

const claude = {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    // Only our tools: --tools "" drops every built-in one, and no user settings
    // means no allow rules, hooks or plugins of theirs. Nor is the chat saved.
    defaultArgs: [
        '-p --strict-mcp-config --mcp-config {mcp_config}',
        `--allowedTools "mcp__${SERVER_NAME}__*"`,
        '--disallowedTools Bash,Edit,Write,Read,WebFetch',
        '--tools "" --setting-sources ""',
        '--disable-slash-commands --no-session-persistence'
    ].join(' '),
    prepare: ({ url, token, system, prompt }) => ({
        mcpConfig: JSON.stringify({
            mcpServers: {
                [SERVER_NAME]: {
                    type: 'http',
                    url,
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: AGENT_CALL_TIMEOUT_MS
                }
            }
        }),
        args: ['--system-prompt', system],
        env: {
            // Else an @path anywhere in the prompt (Redis data included)
            // attaches that file, whatever the tool rules say.
            CLAUDE_CODE_DISABLE_ATTACHMENTS: '1',
            // Else a call waiting for its approval is given up after 5 min.
            CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: String(AGENT_CALL_TIMEOUT_MS)
        },
        stdin: prompt
    })
};

const AGENTS = [claude];

const agentById = (id) => AGENTS.find((agent) => agent.id === id);

// The Arguments field as argv. No shell: only quotes group words.
function splitArgs(text) {
    const words = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    return words.map((word) =>
        word.replace(/"([^"]*)"|'([^']*)'/g, (_, a, b) => a ?? b)
    );
}

module.exports = { AGENTS, agentById, splitArgs };
