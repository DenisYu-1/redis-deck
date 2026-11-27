// One turn of the assistant on a Local agent. The CLI runs its own tool loop
// against this turn's endpoint: rows and approval cards come from there, and
// its stdout is the answer, as plain text.
const { safeMessage } = require('../mcp/errors');
const { createAssistantServer } = require('./assistantServer');
const { agentById } = require('./agents');
const { runAgent, failureOf } = require('./agentProcess');
const { turnSystemPrompt, toolEvents } = require('./turnSetup');
const { maskSecret } = require('./text');

const SPEAKERS = { user: 'User', assistant: 'Assistant' };

// Every turn sends the whole chat; the CLI resumes no session.
const promptOf = (messages) =>
    [
        'The chat so far. Answer the last User message.',
        ...messages.map((m) => `${SPEAKERS[m.role]}: ${m.text}`)
    ].join('\n\n');

// Counts the tool calls in progress -> { track(event), idle() }.
function openCalls() {
    const running = new Set();
    let settled = () => {};
    return {
        track({ id, status }) {
            if (status === 'running') running.add(id);
            else running.delete(id);
            if (running.size === 0) settled();
        },
        idle: () =>
            new Promise((resolve) => {
                settled = resolve;
                if (running.size === 0) resolve();
            })
    };
}

// The request of turnRunner.runTurn, with model: { agent, path, args }.
async function runAgentTurn({
    chatId,
    connectionId,
    messages,
    model,
    emit,
    signal
}) {
    const agent = agentById(model.agent);
    const system = turnSystemPrompt(connectionId);
    const events = toolEvents(emit);
    // Aborted once the agent is gone: no card may stay waiting for it.
    const ended = new AbortController();
    const limit = new AbortController();
    const calls = openCalls();
    let limitReached = null;
    const server = createAssistantServer({
        chatId,
        restoreText: agent.restore,
        signal: AbortSignal.any([ended.signal, signal].filter(Boolean)),
        ...events,
        onCall: (call) => {
            events.onCall(call);
            calls.track(call);
        },
        onLimit: (message) => {
            limitReached = message;
            limit.abort();
        }
    });
    let answered = false;
    let failure = null;
    try {
        const result = await runAgent({
            agent,
            path: model.path,
            args: model.args,
            server,
            system,
            prompt: promptOf(messages),
            signal: AbortSignal.any([limit.signal, signal].filter(Boolean)),
            onText: (text) => {
                answered = true;
                emit({ type: 'text', text });
            }
        });
        failure = failureOf(agent, result);
        if (!failure && !answered) {
            failure = `${agent.name} printed no answer.`;
        }
        failure &&= maskSecret(failure, result.token);
    } catch (error) {
        failure = error.message;
    }
    ended.abort();
    await calls.idle();
    if (limitReached) {
        emit({ type: 'notice', text: limitReached });
    } else if (failure && !signal?.aborted) {
        emit({ type: 'error', message: safeMessage(failure, connectionId) });
    }
    emit({ type: 'done' });
}

module.exports = { runAgentTurn };
