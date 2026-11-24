// Connects an MCP client to an in-process MCP server over the SDK's in-memory
// transport. deps go to createMcpServer (approver, clock, ...).
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { createMcpServer } = require('../../services/mcp/server');

async function connectMcp(deps = {}) {
    const server = createMcpServer(deps);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    // Calls a tool -> { ok: true, data } (data is the parsed JSON result) or
    // { ok: false, error } with the error text the AI client sees.
    async function call(name, args = {}) {
        const res = await client.callTool({ name, arguments: args });
        const text = res.content?.[0]?.text ?? '';
        if (res.isError) {
            return { ok: false, error: text };
        }
        return { ok: true, data: JSON.parse(text) };
    }

    return {
        client,
        call,
        close: () => client.close()
    };
}

module.exports = { connectMcp };
