// The MCP server: one McpServer with the Redis Deck tool registry. Transport-
// free, so the --mcp entry wires stdio and tests wire the in-memory pair.
//
// deps:
//   approver, approvalTimeoutMs   see approvals.js (asked for guarded writes)
//   clock() -> ms since epoch     (budgets, session grants)
//   tools                         (defaults to every tool)
//   clientName                    logged instead of the handshake's name
//   maxCalls, onCall, onLimit     see callMeter.js
//   onWrite(card)                 what became of a write (see writeGate.js)
// Each tool: { name, description, access: 'read' | 'write', inputSchema
// (zod raw shape), run(args, ctx) -> JSON-able result }; a write also has
// target (tools/shared.js), the Key or Workflow it names. Throwing fails the
// call with a message scrubbed of Connection config.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { version } = require('../../package.json');
const {
    ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const allTools = require('./tools');
const { isToolEnabled } = require('./toolSwitches');
const { safeMessage } = require('./errors');
const { createApprovals } = require('./approvals');
const { meterCalls, OUTCOME } = require('./callMeter');
const { recordActivity, clientLabel, RESULTS } = require('../aiActivity');
const { blockedReason, writeGate } = require('./writeGate');

const denyAll = async () => 'deny';

function createMcpServer({
    approver = denyAll,
    clock = Date.now,
    approvalTimeoutMs,
    tools = allTools,
    clientName,
    maxCalls,
    onCall,
    onLimit,
    onWrite,
    restoreText
} = {}) {
    const server = new McpServer({ name: 'redis-deck', version });
    const ctx = {
        approvals: createApprovals({
            approver,
            clock,
            timeoutMs: approvalTimeoutMs
        }),
        clock,
        onWrite,
        metered: Boolean(maxCalls || onCall),
        // AI client name (for dialogs and logs): the host's, else the one
        // from the initialize handshake.
        clientName: () =>
            clientName ?? server.server.getClientVersion()?.name ?? 'unknown'
    };
    for (const tool of tools) {
        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: { readOnlyHint: tool.access === 'read' }
            },
            (args) => invokeTagged(tool, args ?? {}, ctx)
        );
    }
    hideTurnedOffTools(server);
    if (ctx.metered) {
        meterCalls(server, {
            maxCalls,
            onCall,
            onLimit,
            restoreText,
            clock,
            refuse: (name, args, why) =>
                refusePastLimit(tools, name, args, why, ctx)
        });
    }
    return server;
}

// A call past the host's limit: not run, but logged as an attempt.
function refusePastLimit(tools, name, args, why, ctx) {
    const tool = tools.find((t) => t.name === name);
    if (tool) {
        logActivity(tool, args, ctx, ctx.clock(), RESULTS.blocked, {
            error: why
        });
    }
    return errorResult(why);
}

// Turned-off tools drop out of tools/list. The switch is read on every list,
// so it applies to a running session too; the call itself is refused in
// invoke(). Wraps the SDK's own handler (it holds the schema conversion); the
// handler map is private SDK state, hence the guard.
function hideTurnedOffTools(server) {
    const original = server.server._requestHandlers?.get('tools/list');
    if (!original) return;
    server.server.setRequestHandler(ListToolsRequestSchema, async (...args) => {
        const result = await original(...args);
        return {
            ...result,
            tools: result.tools.filter((t) => isToolEnabled(t.name))
        };
    });
}

const errorResult = (text) => ({
    isError: true,
    content: [{ type: 'text', text }]
});

// AI activity entry for every call, reads and refusals included. A failing
// log write never fails the tool call.
function logActivity(
    tool,
    args,
    ctx,
    started,
    result,
    { error, response } = {}
) {
    try {
        recordActivity({
            time: ctx.clock(),
            client: clientLabel(ctx.clientName()),
            connectionId: args.connectionId,
            operation: tool.name,
            target: tool.target?.of(args),
            result,
            error,
            args,
            response,
            durationMs: ctx.clock() - started
        });
    } catch (logError) {
        console.error('Failed to log AI activity:', logError.message);
    }
}

// The result of invoke(), tagged with its outcome for the call meter.
async function invokeTagged(tool, args, ctx) {
    const [outcome, result] = await invoke(tool, args, ctx);
    return ctx.metered ? { ...result, [OUTCOME]: outcome } : result;
}

// -> [outcome (one of RESULTS), MCP tool result]
async function invoke(tool, args, ctx) {
    const started = ctx.clock();
    const gate = tool.access === 'read' ? null : writeGate(tool, args, ctx);
    const refuse = (outcome, text) => {
        logActivity(tool, args, ctx, started, outcome, { error: text });
        // A denied write needs no reason on its card: the user knows.
        const reason = outcome === RESULTS.blocked ? { reason: text } : {};
        gate?.report(outcome, reason);
        return [outcome, errorResult(text)];
    };

    const blocked = blockedReason(tool, args);
    if (blocked) return refuse(RESULTS.blocked, blocked);
    const refusal = await gate?.ask();
    if (refusal) return refuse(refusal.outcome, refusal.text);
    try {
        const data = await tool.run(args, ctx);
        logActivity(tool, args, ctx, started, RESULTS.ok, { response: data });
        gate?.ran({ data });
        const content = [{ type: 'text', text: JSON.stringify(data) }];
        return [RESULTS.ok, { content }];
    } catch (error) {
        const message = safeMessage(error, args.connectionId);
        logActivity(tool, args, ctx, started, RESULTS.error, {
            error: message
        });
        gate?.ran({ error: message });
        return [RESULTS.error, errorResult(message)];
    }
}

module.exports = { createMcpServer };
