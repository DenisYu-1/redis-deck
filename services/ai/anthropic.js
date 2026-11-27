// Anthropic Messages API over plain fetch (no SDK): the model adapter of the
// turn runner (see turnRunner.js) and the Test call of the model settings.
const { sseData } = require('./sse');
const {
    NOTICES: SHARED_NOTICES,
    TIMEOUT_MS,
    openReply,
    pingResult
} = require('./providerHttp');

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const MAX_TOKENS = 16000;

const LABEL = 'Anthropic';
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';

// By stop_reason.
const NOTICES = {
    max_tokens: SHARED_NOTICES.length,
    refusal: SHARED_NOTICES.refusal
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

// The smallest call that proves the key and model work. Returns
// { ok, status, error }; throws when Anthropic cannot be reached.
async function ping({ apiKey, model }) {
    const response = await post(
        apiKey,
        { model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] },
        AbortSignal.timeout(TIMEOUT_MS)
    );
    return pingResult(response);
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
            const body = {
                model,
                max_tokens: MAX_TOKENS,
                stream: true,
                system,
                tools: definitions,
                messages: history
            };
            const response = await openReply(
                LABEL,
                (abort) => post(apiKey, body, abort),
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
