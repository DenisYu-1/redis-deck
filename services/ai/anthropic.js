// Anthropic Messages API over plain fetch (no SDK): the model adapter of the
// turn runner (see turnRunner.js) and the Test call of the model settings.
const { sseData } = require('./sse');

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const TIMEOUT_MS = 30_000;
// One streamed reply of a turn.
const REPLY_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TOKENS = 16000;

const LABEL = 'Anthropic';
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';

const NOTICES = {
    max_tokens: 'The answer was cut off at the length limit.',
    refusal: 'The model declined to answer.'
};

const post = (apiKey, body, signal) =>
    fetch(MESSAGES_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal
    });

async function errorOf(response) {
    const body = await response.json().catch(() => null);
    return body?.error?.message || response.statusText;
}

// The smallest call that proves the key and model work. Returns
// { ok, status, error }; throws when Anthropic cannot be reached.
async function ping({ apiKey, model }) {
    const response = await post(
        apiKey,
        { model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] },
        AbortSignal.timeout(TIMEOUT_MS)
    );
    if (response.ok) return { ok: true, status: response.status };
    return {
        ok: false,
        status: response.status,
        error: await errorOf(response)
    };
}

async function openReply(apiKey, body, signal) {
    const timeout = AbortSignal.timeout(REPLY_TIMEOUT_MS);
    let response;
    try {
        response = await post(
            apiKey,
            body,
            signal ? AbortSignal.any([signal, timeout]) : timeout
        );
    } catch (error) {
        const cause = error.cause?.message || error.message;
        throw new Error(`Could not reach ${LABEL}: ${cause}`);
    }
    if (!response.ok) {
        const message = await errorOf(response);
        throw new Error(`${LABEL} returned ${response.status}: ${message}`);
    }
    return response;
}

// Adds one delta to the content block it belongs to.
function grow(block, delta, onText) {
    if (delta.type === 'text_delta') {
        block.text += delta.text;
        onText(delta.text);
    } else if (delta.type === 'input_json_delta') {
        block.json = (block.json ?? '') + delta.partial_json;
    } else if (delta.type === 'thinking_delta') {
        block.thinking += delta.thinking;
    } else if (delta.type === 'signature_delta') {
        block.signature = delta.signature;
    }
}

// Reads one streamed reply -> { content: its blocks, stopReason }.
async function readReply(body, onText) {
    const content = [];
    let stopReason = null;
    for await (const data of sseData(body)) {
        const event = JSON.parse(data);
        if (event.type === 'content_block_start') {
            content[event.index] = { ...event.content_block };
        } else if (event.type === 'content_block_delta') {
            grow(content[event.index], event.delta, onText);
        } else if (event.type === 'message_delta') {
            stopReason = event.delta.stop_reason;
        } else if (event.type === 'error') {
            throw new Error(`${LABEL}: ${event.error?.message}`);
        } else if (event.type === 'message_stop') {
            return { content, stopReason };
        }
    }
    throw new Error(`${LABEL} closed the reply before it was complete`);
}

// A tool call's input arrives as pieces of JSON text.
function finishBlock({ json, ...block }) {
    return json ? { ...block, input: JSON.parse(json) } : block;
}

// The adapter. Within a turn the replies go back exactly as received (thinking
// blocks included), which is why the history lives here.
function start({ apiKey, model, system, tools, messages }) {
    const history = messages
        .filter((m) => m.text)
        .map((m) => ({ role: m.role, content: m.text }));
    const definitions = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema
    }));

    return {
        async step({ onText, signal }) {
            const response = await openReply(
                apiKey,
                {
                    model,
                    max_tokens: MAX_TOKENS,
                    stream: true,
                    system,
                    tools: definitions,
                    messages: history
                },
                signal
            );
            const reply = await readReply(response.body, onText);
            // A reply that stopped early may hold half a tool call.
            if (reply.stopReason !== 'tool_use') {
                return { toolCalls: [], notice: NOTICES[reply.stopReason] };
            }
            const content = reply.content.map(finishBlock);
            history.push({ role: 'assistant', content });
            return {
                toolCalls: content
                    .filter((block) => block.type === 'tool_use')
                    .map(({ id, name, input }) => ({ id, name, args: input })),
                notice: undefined
            };
        },
        addToolResults(results) {
            history.push({
                role: 'user',
                content: results.map((r) => ({
                    type: 'tool_result',
                    tool_use_id: r.id,
                    content: r.text,
                    is_error: r.isError
                }))
            });
        }
    };
}

module.exports = { LABEL, MODELS, DEFAULT_MODEL, ping, start };
