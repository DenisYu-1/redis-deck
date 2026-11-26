// Supported AI clients. One entry per client:
//   id, name   — shown in the panel; id is the route parameter
//   detect     — (home) => paths, any of which proves the client is on this machine
//   configPath — (home) => absolute path of the client's config file
//   format     — read/write/remove/snippet over the file text (see formats/)
//   entry      — ({ command, args }) => the server entry stored under `redis-deck`
const path = require('path');
const jsonMcpServers = require('./formats/jsonMcpServers');
const codexToml = require('./formats/codexToml');

module.exports = [
    {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        detect: (home) => [
            path.join(home, 'Library', 'Application Support', 'Claude')
        ],
        configPath: (home) =>
            path.join(
                home,
                'Library',
                'Application Support',
                'Claude',
                'claude_desktop_config.json'
            ),
        format: jsonMcpServers,
        entry: ({ command, args }) => ({ command, args })
    },
    {
        id: 'claude-code',
        name: 'Claude Code',
        detect: (home) => [
            path.join(home, '.claude'),
            path.join(home, '.claude.json')
        ],
        configPath: (home) => path.join(home, '.claude.json'),
        format: jsonMcpServers,
        entry: ({ command, args }) => ({ type: 'stdio', command, args })
    },
    {
        id: 'codex',
        name: 'Codex',
        detect: (home) => [path.join(home, '.codex')],
        configPath: (home) => path.join(home, '.codex', 'config.toml'),
        format: codexToml,
        entry: ({ command, args }) => ({ command, args })
    },
    {
        id: 'cursor',
        name: 'Cursor',
        detect: (home) => [path.join(home, '.cursor')],
        configPath: (home) => path.join(home, '.cursor', 'mcp.json'),
        format: jsonMcpServers,
        entry: ({ command, args }) => ({ command, args })
    },
    {
        id: 'pi',
        name: 'Pi',
        detect: (home) => [path.join(home, '.pi')],
        configPath: (home) => path.join(home, '.pi', 'agent', 'mcp.json'),
        format: jsonMcpServers,
        entry: ({ command, args }) => ({ command, args })
    }
];
