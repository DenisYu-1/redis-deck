// The internal Streamable HTTP MCP endpoint of one agent turn. Its own listener
// on 127.0.0.1 (the app's server may be open to the network and has no login),
// answering only the turn's random token; both end with the turn. AI clients
// never get it: they use stdio --mcp.
const http = require('http');
const { randomBytes, randomUUID, timingSafeEqual } = require('crypto');
const {
    StreamableHTTPServerTransport
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const HOST = '127.0.0.1';
const PATH = '/mcp';

function carries(request, token) {
    const given = Buffer.from(request.headers.authorization ?? '');
    const wanted = Buffer.from(`Bearer ${token}`);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
}

// server: the McpServer the endpoint serves, for one MCP session.
// -> { url, token, close() }
async function openAgentEndpoint(server) {
    const token = randomBytes(32).toString('base64url');
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID
    });
    await server.connect(transport);

    const listener = http.createServer((request, response) => {
        if (!carries(request, token)) return response.writeHead(401).end();
        if (request.url !== PATH) return response.writeHead(404).end();
        transport.handleRequest(request, response).catch((error) => {
            console.error('Agent endpoint request failed:', error.message);
            response.destroy();
        });
    });
    await new Promise((resolve, reject) => {
        listener.once('error', reject);
        listener.listen(0, HOST, resolve);
    });

    return {
        url: `http://${HOST}:${listener.address().port}${PATH}`,
        token,
        async close() {
            await server.close();
            listener.closeAllConnections();
            await new Promise((resolve) => listener.close(resolve));
        }
    };
}

module.exports = { openAgentEndpoint };
