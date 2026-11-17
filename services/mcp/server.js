// The MCP server: one McpServer with the Redis Deck tool registry. Transport-
// free, so the --mcp entry wires stdio and tests wire the in-memory pair.
//
// deps:
//   approver(request) -> 'deny' | 'once' | 'session'  (asked for guarded writes)
//   clock() -> ms since epoch                          (budgets, session grants)
//   tools                                              (defaults to every tool)
// Each tool: { name, description, access: 'read' | 'write', inputSchema
// (zod raw shape), run(args, ctx) -> JSON-able result }. Throwing fails the
// call with a message scrubbed of Connection config.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { version } = require('../../package.json');
const readTools = require('./tools/read');
const { safeMessage } = require('./errors');

const denyAll = async () => 'deny';

function createMcpServer({
    approver = denyAll,
    clock = Date.now,
    tools = readTools
} = {}) {
    const server = new McpServer({ name: 'redis-deck', version });
    const ctx = {
        approver,
        clock,
        // AI client name from the initialize handshake (for dialogs and logs).
        clientName: () => server.server.getClientVersion()?.name ?? 'unknown'
    };
    for (const tool of tools) {
        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: { readOnlyHint: tool.access === 'read' }
            },
            (args) => invoke(tool, args ?? {}, ctx)
        );
    }
    return server;
}

async function invoke(tool, args, ctx) {
    try {
        const data = await tool.run(args, ctx);
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (error) {
        return {
            isError: true,
            content: [
                { type: 'text', text: safeMessage(error, args.connectionId) }
            ]
        };
    }
}

module.exports = { createMcpServer };
