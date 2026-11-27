// An MCP client wired to a server in this process over the SDK's in-memory
// transport: how a turn that runs its own tool loop reaches the tools.
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { version } = require('../../package.json');
// The SDK gives up after 60 s by default.
const { AGENT_CALL_TIMEOUT_MS } = require('./limits');

// -> { listTools(), call({ name, args }, signal) -> { text, isError }, close() }
async function openToolSession(server) {
    const client = new Client({ name: 'redis-deck-assistant', version });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    return {
        listTools: async () => (await client.listTools()).tools,
        async call({ name, args }, signal) {
            try {
                const result = await client.callTool(
                    { name, arguments: args },
                    undefined,
                    { signal, timeout: AGENT_CALL_TIMEOUT_MS }
                );
                return {
                    text: result.content?.[0]?.text ?? '',
                    isError: Boolean(result.isError)
                };
            } catch (error) {
                signal?.throwIfAborted();
                return { text: error.message, isError: true };
            }
        },
        close: () => client.close()
    };
}

module.exports = { openToolSession };
