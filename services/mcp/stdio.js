// Serves the MCP server on stdin/stdout. stdout carries only protocol
// messages, so the services' console.log chatter is moved to stderr first.
const {
    StdioServerTransport
} = require('@modelcontextprotocol/sdk/server/stdio.js');

function routeConsoleToStderr() {
    const toStderr = (...args) => console.error(...args);
    console.log = toStderr;
    console.info = toStderr;
    console.debug = toStderr;
}

// deps: see createMcpServer. onClose runs when the AI client hangs up.
async function startStdio(deps = {}, { onClose = () => {} } = {}) {
    routeConsoleToStderr();
    // Required after the console is rerouted and DATA_DIR is set: loading the
    // services opens the SQLite database.
    const { createMcpServer } = require('./server');
    const server = createMcpServer(deps);
    const transport = new StdioServerTransport();
    transport.onclose = onClose;
    process.stdin.on('end', onClose);
    await server.connect(transport);
    return server;
}

module.exports = { startStdio };
