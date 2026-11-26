// One turn of the AI assistant: the model streams text and asks for tool calls,
// which run on the assistant's MCP server, until it has answered.
const { safeMessage } = require('../mcp/errors');
const { createAssistantServer } = require('./assistantServer');
const { openToolSession } = require('./toolSession');
const { runAgentTurn } = require('./agentTurn');
const { turnSystemPrompt, toolEvents } = require('./turnSetup');
const { maskSecret } = require('./text');

// A provider error can quote the request: never show the key or Connection
// config in the chat.
function errorText(error, apiKey, connectionId) {
    const text = String(error?.message || error);
    return safeMessage(maskSecret(text, apiKey), connectionId);
}

// model: { agent, path, args } (a Local agent, see agentTurn.js) or
// { adapter, apiKey, model, baseUrl }. adapter.start({ apiKey, model,
// baseUrl, system, tools (MCP tool list), messages }) -> { step({ onText, signal }) ->
// { toolCalls: [{ id, name, args }], notice? }, addToolResults([{ id, text,
// isError }]) }. The adapter keeps the provider's own message history.
//
// emit gets { type: 'text', text }, { type: 'tool', ... } (mcp/callMeter.js),
// { type: 'approval', ... } (assistantServer.js), { type: 'notice', text },
// { type: 'error', message } and, last, { type: 'done' }. Aborting signal stops
// the turn without an error and denies the writes still waiting for an answer.
// chatId: the chat whose approval answers count (approvalDesk.js).
async function runTurn(request) {
    return request.model.agent
        ? runAgentTurn(request)
        : runAdapterTurn(request);
}

// A turn whose tool loop runs here, against a provider.
async function runAdapterTurn({
    chatId,
    connectionId,
    messages,
    model,
    emit,
    signal
}) {
    const system = turnSystemPrompt(connectionId);
    let limitReached = null;
    const session = await openToolSession(
        createAssistantServer({
            chatId,
            signal,
            ...toolEvents(emit),
            onLimit: (message) => (limitReached = message)
        })
    );
    try {
        const conversation = model.adapter.start({
            apiKey: model.apiKey,
            model: model.model,
            baseUrl: model.baseUrl,
            system,
            tools: await session.listTools(),
            messages
        });
        for (;;) {
            const { toolCalls, notice } = await conversation.step({
                signal,
                onText: (text) => emit({ type: 'text', text })
            });
            if (notice) emit({ type: 'notice', text: notice });
            if (toolCalls.length === 0) return;
            const results = [];
            for (const call of toolCalls) {
                const result = await session.call(call, signal);
                if (limitReached) {
                    emit({ type: 'notice', text: limitReached });
                    return;
                }
                results.push({ id: call.id, ...result });
            }
            conversation.addToolResults(results);
        }
    } catch (error) {
        if (!signal?.aborted) {
            const message = errorText(error, model.apiKey, connectionId);
            emit({ type: 'error', message });
        }
    } finally {
        await session.close();
        emit({ type: 'done' });
    }
}

module.exports = { runTurn };
