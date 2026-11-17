// Supported AI clients. One entry per client:
//   id, name   — shown in the panel; id is the route parameter
//   configPath — (home) => absolute path of the client's config file
//   format     — read/write/remove/snippet over the file text (see formats/)
//   entry      — ({ command, args }) => the server entry stored under `redis-deck`
const path = require('path');
const jsonMcpServers = require('./formats/jsonMcpServers');

module.exports = [
    {
        id: 'claude-code',
        name: 'Claude Code',
        configPath: (home) => path.join(home, '.claude.json'),
        format: jsonMcpServers,
        entry: ({ command, args }) => ({ type: 'stdio', command, args })
    }
];
