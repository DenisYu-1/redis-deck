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
const writeTools = require('./tools/write');
const { getConnection } = require('../database');
const { safeMessage } = require('./errors');

const denyAll = async () => 'deny';

function createMcpServer({
    approver = denyAll,
    clock = Date.now,
    tools = [...readTools, ...writeTools]
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

// MCP write guard. Uses the same Connection row as guards/writeGuard.js, but
// decides here: the AI client can never send a confirmation itself (tool
// schemas have no such field and unknown arguments are dropped).
// Returns null when the write may run, else the error text.
function refuseWrite(connectionId) {
    const conn = getConnection(connectionId);
    if (!conn) {
        return `Connection '${connectionId}' not found`;
    }
    if (conn.read_only === 1) {
        return `Connection '${connectionId}' is read-only`;
    }
    if (conn.confirm_writes === 1) {
        // Ticket 05 replaces this with ctx.approver + session grants.
        return `Connection '${connectionId}' needs user approval for writes (Confirm writes); approval from AI clients is not available yet`;
    }
    return null;
}

const errorResult = (text) => ({
    isError: true,
    content: [{ type: 'text', text }]
});

async function invoke(tool, args, ctx) {
    if (tool.access !== 'read') {
        const refusal = refuseWrite(args.connectionId);
        if (refusal) {
            return errorResult(refusal);
        }
    }
    try {
        const data = await tool.run(args, ctx);
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (error) {
        return errorResult(safeMessage(error, args.connectionId));
    }
}

module.exports = { createMcpServer };
