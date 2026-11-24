// The MCP server: one McpServer with the Redis Deck tool registry. Transport-
// free, so the --mcp entry wires stdio and tests wire the in-memory pair.
//
// deps:
//   approver, approvalTimeoutMs   see approvals.js (asked for guarded writes)
//   clock() -> ms since epoch     (budgets, session grants)
//   tools                         (defaults to every tool)
// Each tool: { name, description, access: 'read' | 'write', inputSchema
// (zod raw shape), run(args, ctx) -> JSON-able result }; a write also has
// target (tools/shared.js), the Key or Workflow it names. Throwing fails the
// call with a message scrubbed of Connection config.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { version } = require('../../package.json');
const readTools = require('./tools/read');
const writeTools = require('./tools/write');
const workflowTools = require('./tools/workflows');
const { getConnection } = require('../database');
const { safeMessage } = require('./errors');
const { createApprovals } = require('./approvals');
const { recordActivity, RESULTS } = require('../aiActivity');
const { getAiAccess } = require('../aiAccess');
const { checkWrite } = require('../../guards/writeGuard');

// checkWrite's status when the write needs the user's confirmation. That is
// for people in the app only (ADR 0005); for AI clients AI access decides.
const CONFIRM_REQUIRED = 428;

const denyAll = async () => 'deny';

function createMcpServer({
    approver = denyAll,
    clock = Date.now,
    approvalTimeoutMs,
    tools = [...readTools, ...writeTools, ...workflowTools]
} = {}) {
    const server = new McpServer({ name: 'redis-deck', version });
    const ctx = {
        approvals: createApprovals({
            approver,
            clock,
            timeoutMs: approvalTimeoutMs
        }),
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

// MCP write guard: guards/writeGuard.js decides, called without a confirm
// header because the AI client can never confirm a write itself (tool schemas
// have no such field and unknown arguments are dropped). Its 428 is ignored;
// AI access (write / workflows / ask) decides, and the user is asked through
// ctx.approvals when ask is on.
// Returns null when the write may run, else { outcome, text } with outcome
// RESULTS.blocked (not allowed at all) or RESULTS.denied (the user said no).
async function refuseWrite(tool, args, ctx) {
    const { connectionId } = args;
    const conn = getConnection(connectionId);
    if (!conn) {
        return {
            outcome: RESULTS.blocked,
            text: `Connection '${connectionId}' not found`
        };
    }
    const refusal = checkWrite(connectionId);
    if (refusal && refusal.status !== CONFIRM_REQUIRED) {
        return { outcome: RESULTS.blocked, text: refusal.error };
    }
    const access = getAiAccess(connectionId);
    const allowed =
        tool.name === 'run_workflow' ? access.workflows : access.write;
    if (!allowed) {
        const what = tool.name === 'run_workflow' ? 'Workflows' : 'Writes';
        return {
            outcome: RESULTS.blocked,
            text: `${what} are not allowed for AI clients on Connection '${connectionId}'`
        };
    }
    if (!access.ask) {
        return null;
    }
    const approved = await ctx.approvals.approve({
        clientName: ctx.clientName(),
        connectionId,
        tier: conn.tier,
        operation: tool.name,
        target: tool.target?.of(args),
        targetLabel: tool.target?.label
    });
    if (approved) {
        return null;
    }
    return {
        outcome: RESULTS.denied,
        text: `The user denied ${tool.name} on Connection '${connectionId}'`
    };
}

const errorResult = (text) => ({
    isError: true,
    content: [{ type: 'text', text }]
});

// AI activity entry for a write or refused write; reads are never logged.
// A failing log write never fails the tool call.
function logActivity(tool, args, ctx, result, error) {
    if (tool.access === 'read') return;
    try {
        recordActivity({
            time: ctx.clock(),
            client: ctx.clientName(),
            connectionId: args.connectionId,
            operation: tool.name,
            target: tool.target?.of(args),
            result,
            error
        });
    } catch (logError) {
        console.error('Failed to log AI activity:', logError.message);
    }
}

// AI access "See keys" off: the Connection does not exist for AI clients.
function hiddenFrom(args) {
    const access = args.connectionId && getAiAccess(args.connectionId);
    return access && !access.keys;
}

async function invoke(tool, args, ctx) {
    if (hiddenFrom(args)) {
        const text = `Connection '${args.connectionId}' is not available to AI clients`;
        logActivity(tool, args, ctx, RESULTS.blocked, text);
        return errorResult(text);
    }
    if (tool.access !== 'read') {
        const refusal = await refuseWrite(tool, args, ctx);
        if (refusal) {
            logActivity(tool, args, ctx, refusal.outcome, refusal.text);
            return errorResult(refusal.text);
        }
    }
    try {
        const data = await tool.run(args, ctx);
        logActivity(tool, args, ctx, RESULTS.done);
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (error) {
        const message = safeMessage(error, args.connectionId);
        logActivity(tool, args, ctx, RESULTS.failed, message);
        return errorResult(message);
    }
}

module.exports = { createMcpServer };
