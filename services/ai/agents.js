// The agent CLIs a turn can run on. One entry each:
//   id, name, command
//   defaultArgs    the Arguments field's default; {mcp_config} stands for the
//                  path of the file with mcpConfig
//   prepare({ url, token, system, prompt }) -> how one turn reaches the
//                  endpoint at url: { mcpConfig? (file text), files?
//                  ({ path in the turn's folder: text }), args (appended),
//                  env, stdin }
//   restore?(text) -> what the agent wrote, without what prepare escaped
//   errorOf?(stderr) -> what to report of a failed run's stderr
const { AGENT_CALL_TIMEOUT_MS } = require('./limits');

const SERVER_NAME = 'redis-deck';
const TOKEN_ENV = 'REDIS_DECK_MCP_TOKEN';

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

// Codex adds the SKILL.md of every $name in the prompt, Redis data included.
// A zero-width space after the $ stops it; a backslash does not.
const BROKEN_MENTION = '$​';

// Built-in tools of Codex: commands (which the read-only sandbox lets read the
// whole disk), image reading, sub-agents, connectors and the user's hooks.
const CODEX_OFF = [
    'shell_tool',
    'unified_exec',
    'view_image',
    'multi_agent',
    'apps',
    'plugins',
    'hooks',
    'goals',
    'image_generation'
];

const codex = {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    // The prompt comes on stdin. Not the user's config.toml (its MCP servers,
    // one of them maybe our own stdio one) and no saved session.
    defaultArgs: [
        'exec --sandbox read-only',
        '--ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check',
        ...CODEX_OFF.map((feature) => `--disable ${feature}`),
        '-c web_search=disabled -c agents.enabled=false'
    ].join(' '),
    prepare: ({ url, token, system, prompt }) => {
        // -c values are TOML; a JSON string is a TOML string.
        const server = (key, value) => [
            '-c',
            `mcp_servers.${SERVER_NAME}.${key}=${JSON.stringify(value)}`
        ];
        return {
            args: [
                ...server('url', url),
                // The token stays out of argv, which other users can list.
                ...server('bearer_token_env_var', TOKEN_ENV),
                // Else exec has nobody to ask, and cancels the call. The
                // approval card is Redis Deck's own.
                ...server('default_tools_approval_mode', 'approve'),
                ...server('tool_timeout_sec', AGENT_CALL_TIMEOUT_MS / 1000),
                ...server('required', true),
                '-c',
                `developer_instructions=${JSON.stringify(system)}`
            ],
            env: { [TOKEN_ENV]: token },
            stdin: prompt.replace(/\$(?=[\w:-])/g, BROKEN_MENTION)
        };
    },
    restore: (text) => text.replaceAll(BROKEN_MENTION, '$'),
    // stderr repeats the whole prompt; the reason is its last ERROR line.
    errorOf: (stderr) =>
        stderr.split('\n').findLast((line) => /^error:/i.test(line)) ??
        stderr.slice(-500)
};

// Gemini reads the file of every @path in the prompt, Redis data included,
// whatever its tool policy says. \@ is its own escape.
const escapeAt = (text) => text.replace(/(?<!\\)@/g, '\\@');

// Denies every tool but ours. As an admin policy it outranks the user's rules.
const GEMINI_POLICY_FILE = 'policy.toml';
const GEMINI_POLICY = `[[rule]]
toolName = "*"
decision = "deny"
priority = 100

[[rule]]
mcpName = "${SERVER_NAME}"
toolName = "*"
decision = "allow"
priority = 200
`;

// Built from its docs and source; never run against the real CLI.
const gemini = {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    // -p: not interactive; its text follows the prompt on stdin.
    defaultArgs: [
        '-p "Answer as asked above." -o text',
        `--allowed-mcp-server-names ${SERVER_NAME} -e none`,
        `--admin-policy ${GEMINI_POLICY_FILE}`
    ].join(' '),
    prepare: ({ url, token, system, prompt }) => {
        // The settings of the turn's folder, which win over the user's.
        const settings = {
            mcpServers: {
                [SERVER_NAME]: {
                    httpUrl: url,
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: AGENT_CALL_TIMEOUT_MS,
                    trust: true
                }
            },
            mcp: { allowed: [SERVER_NAME] },
            // Not the user's GEMINI.md, hooks or skills: no file has this name.
            context: { fileName: 'REDIS_DECK_NO_CONTEXT.md' },
            hooksConfig: { enabled: false },
            skills: { enabled: false }
        };
        return {
            files: {
                '.gemini/settings.json': JSON.stringify(settings),
                [GEMINI_POLICY_FILE]: GEMINI_POLICY
            },
            args: [],
            // Else the new folder is untrusted, and loads no MCP server.
            env: { GEMINI_CLI_TRUST_WORKSPACE: 'true' },
            // It has no flag for a system prompt.
            stdin: escapeAt(`${system}\n\n${prompt}`)
        };
    },
    restore: (text) => text.replaceAll('\\@', '@')
};

const AGENTS = [claude, codex, gemini];

const agentById = (id) => AGENTS.find((agent) => agent.id === id);

// The Arguments field as argv. No shell: only quotes group words.
function splitArgs(text) {
    const words = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    return words.map((word) =>
        word.replace(/"([^"]*)"|'([^']*)'/g, (_, a, b) => a ?? b)
    );
}

module.exports = { AGENTS, agentById, splitArgs };
