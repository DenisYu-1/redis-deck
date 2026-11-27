// Watches every tools/call of one server, whichever transport it arrives on:
// reports a start and an end event to the host, and refuses calls past
// maxCalls. It wraps the SDK's own handler, so calls the SDK rejects itself
// (unknown tool, bad arguments) are counted and reported too.
const { CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { RESULTS } = require('../aiActivity');

// Result field invoke() puts the call's outcome (one of RESULTS) in, for
// metered servers. Removed again before the result leaves the server.
const OUTCOME = 'redisDeckOutcome';

// The tools/call request with its arguments' strings restored.
function restored(request, restoreText) {
    if (!restoreText || !request.params.arguments) return request;
    const args = JSON.parse(
        JSON.stringify(request.params.arguments),
        (_, value) => (typeof value === 'string' ? restoreText(value) : value)
    );
    return { ...request, params: { ...request.params, arguments: args } };
}

// meter: { maxCalls, onCall(event), onLimit(message), clock,
// refuse(name, args, message) -> the result of a call past the limit,
// restoreText?(text) -> applied to every string of the arguments first }.
// onCall gets
// { id, tool, args, status: 'running' }, then
// { id, tool, args, status: one of RESULTS, ms, response: result text }.
function meterCalls(server, meter) {
    const { maxCalls = Infinity, onCall = () => {}, clock } = meter;
    const original = server.server._requestHandlers?.get('tools/call');
    // Private SDK state; without it the limit would silently not hold.
    if (!original) {
        throw new Error('The MCP SDK no longer exposes its tools/call handler');
    }
    let calls = 0;
    const limitMessage = `Stopped after ${maxCalls} tool calls; ask again to continue`;
    server.server.setRequestHandler(
        CallToolRequestSchema,
        async (sent, extra) => {
            const request = restored(sent, meter.restoreText);
            const { name: tool, arguments: args = {} } = request.params;
            calls += 1;
            if (calls > maxCalls) {
                meter.onLimit?.(limitMessage);
                return meter.refuse(tool, args, limitMessage);
            }
            const call = { id: `call-${calls}`, tool, args };
            const started = clock();
            onCall({ ...call, status: 'running' });
            const { [OUTCOME]: outcome, ...result } = await original(
                request,
                extra
            );
            onCall({
                ...call,
                status:
                    outcome ?? (result.isError ? RESULTS.error : RESULTS.ok),
                ms: clock() - started,
                response: result.content?.[0]?.text ?? ''
            });
            return result;
        }
    );
}

module.exports = { meterCalls, OUTCOME };
