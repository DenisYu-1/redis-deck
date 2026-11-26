// The way of one call to run: whether it may at all, and for a write whether
// the user has to approve it first.
const { randomUUID } = require('crypto');
const { isToolEnabled } = require('./toolSwitches');
const { describeWrite } = require('./writeCard');
const { getConnection } = require('../database');
const { getAiAccess } = require('../aiAccess');
const { RESULTS } = require('../aiActivity');
const { checkWrite } = require('../../guards/writeGuard');

// checkWrite's status when the write needs the user's confirmation. That is
// for people in the app only (ADR 0005); for AI clients and the AI assistant AI
// access decides.
const CONFIRM_REQUIRED = 428;

const TURNED_OFF = 'tool is turned off';

// AI access "See keys" off: the Connection does not exist for any AI.
function hiddenFrom(args) {
    const access = args.connectionId && getAiAccess(args.connectionId);
    return access && !access.keys;
}

// MCP write guard: guards/writeGuard.js decides, called without a confirm
// header because the AI client can never confirm a write itself (tool schemas
// have no such field and unknown arguments are dropped). Its 428 is ignored;
// AI access (write / workflows) decides.
function writeBlock(tool, { connectionId }) {
    if (!getConnection(connectionId)) {
        return `Connection '${connectionId}' not found`;
    }
    const refusal = checkWrite(connectionId);
    if (refusal && refusal.status !== CONFIRM_REQUIRED) {
        return refusal.error;
    }
    const access = getAiAccess(connectionId);
    const isWorkflow = tool.name === 'run_workflow';
    if (isWorkflow ? access.workflows : access.write) {
        return null;
    }
    const what = isWorkflow ? 'Workflows' : 'Writes';
    return `${what} are not allowed by AI access on Connection '${connectionId}'`;
}

// Why the call may not run at all, or null.
function blockedReason(tool, args) {
    if (!isToolEnabled(tool.name)) {
        return TURNED_OFF;
    }
    if (hiddenFrom(args)) {
        return `Connection '${args.connectionId}' is not available: AI access "See keys" is off`;
    }
    return tool.access === 'read' ? null : writeBlock(tool, args);
}

// The approval request of one write call: what the approver is asked.
function approvalRequest(tool, args, clientName) {
    return {
        id: randomUUID(),
        clientName,
        connectionId: args.connectionId,
        tier: getConnection(args.connectionId)?.tier,
        operation: tool.name,
        target: tool.target?.of(args),
        targetLabel: tool.target?.label,
        ...describeWrite(tool, args)
    };
}

// What an approval card shows of a request.
const cardOf = ({ id, operation, connectionId, title, commands }) => ({
    id,
    tool: operation,
    connectionId,
    title,
    commands
});

// One write call on its way. ask() gets the user's approval where AI access
// wants it -> null when the write may run, else { outcome, text }. report()
// and ran() tell the host what became of the call, as an approval card:
// { ...cardOf, state: 'approved' | 'auto' | 'denied' | 'blocked', reason?,
// done?, error? }. 'auto' is a write that ran without asking.
function writeGate(tool, args, ctx) {
    const { connectionId } = args;
    const request = approvalRequest(tool, args, ctx.clientName());
    let asked = false;
    const report = (state, details) =>
        ctx.onWrite?.({ ...cardOf(request), state, ...details });

    async function ask() {
        if (!getAiAccess(connectionId).ask) {
            return null;
        }
        asked = true;
        if (!(await ctx.approvals.approve(request))) {
            return {
                outcome: RESULTS.denied,
                text: `The user denied ${tool.name} on Connection '${connectionId}'`
            };
        }
        // The wait can be minutes: the rules may have changed meanwhile.
        const late = blockedReason(tool, args);
        return late ? { outcome: RESULTS.blocked, text: late } : null;
    }

    // The write ran, with its result or the error it threw.
    function ran({ data, error }) {
        const outcome = error ? { error } : { done: tool.card?.done(data) };
        if (asked) {
            report('approved', outcome);
        } else {
            const reason = `Ask before writes is off for ${connectionId}`;
            report('auto', { reason, ...outcome });
        }
    }

    return { ask, ran, report };
}

module.exports = { blockedReason, writeGate, cardOf };
