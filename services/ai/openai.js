// OpenAI Chat Completions over plain fetch (no SDK): OpenAI itself,
// OpenAI-compatible servers and the Local model. Each is an adapter of the turn
// runner (see turnRunner.js) with a ping for Test.
const { sseData } = require('./sse');
const {
    NOTICES: SHARED_NOTICES,
    TIMEOUT_MS,
    errorOf,
    openReply,
    pingResult
} = require('./providerHttp');

const OPENAI_URL = 'https://api.openai.com/v1';
const PING_TOKENS = 16;

// By finish_reason. A reply that stopped early may hold half a tool call.
const NOTICES = {
    length: SHARED_NOTICES.length,
    content_filter: SHARED_NOTICES.refusal
};

// One request to <base><path>, with the key only if there is one. A redirect
// would carry the key or the chat to an address the user never entered.
const request = (base, path, apiKey, { body, signal }) =>
    fetch(`${base}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            ...(apiKey && { authorization: `Bearer ${apiKey}` }),
            ...(body && { 'content-type': 'application/json' })
        },
        ...(body && { body: JSON.stringify(body) }),
        redirect: 'error',
        signal
    });

// A call's pieces arrive by index. Some servers send no index: then every
// entry is a whole call.
function collect(calls, pieces) {
    for (const piece of pieces) {
        const index = piece.index ?? calls.length;
        const call = (calls[index] ??= { id: '', name: '', json: '' });
        const { name, arguments: json = '' } = piece.function ?? {};
        if (piece.id) call.id = piece.id;
        if (name) call.name = name;
        // A few servers send the arguments as an object.
        call.json += typeof json === 'string' ? json : JSON.stringify(json);
    }
}

// Reads one streamed reply -> { text, calls, finishReason }.
async function readReply(body, label, onText) {
    let text = '';
    let finishReason = null;
    const calls = [];
    for await (const data of sseData(body)) {
        if (data === '[DONE]') break;
        const { error, choices } = JSON.parse(data);
        if (error) throw new Error(`${label}: ${error.message ?? error}`);
        const choice = choices?.[0];
        if (!choice) continue;
        const chunk = choice.delta?.content || choice.delta?.refusal;
        if (chunk) {
            text += chunk;
            onText(chunk);
        }
        collect(calls, choice.delta?.tool_calls ?? []);
        finishReason = choice.finish_reason ?? finishReason;
    }
    if (!finishReason) {
        throw new Error(`${label} closed the reply before it was complete`);
    }
    return { text, calls: calls.filter(Boolean), finishReason };
}

// Small models send broken JSON now and then; the tool then refuses the missing
// arguments and the model can try again.
function argsOf(json) {
    try {
        const args = JSON.parse(json || '{}');
        return args && typeof args === 'object' ? args : {};
    } catch {
        return {};
    }
}

// The assistant's turn that asked for these calls, as the API wants it back.
const askedFor = (text, toolCalls) => ({
    role: 'assistant',
    content: text || null,
    tool_calls: toolCalls.map(({ id, name, args }) => ({
        id,
        type: 'function',
        function: { name, arguments: JSON.stringify(args) }
    }))
});

// label: how errors name the server. url: the fixed API address; without it the
// caller's baseUrl is used. tokenLimit: the field that limits the Test call.
function openAiAdapter({ label, url, tokenLimit = 'max_tokens' }) {
    const chat = (apiKey, baseUrl, body, signal) =>
        request(url ?? baseUrl, '/chat/completions', apiKey, { body, signal });

    // The smallest call that proves the key and model work. Throws when the
    // server cannot be reached.
    async function ping({ apiKey, model, baseUrl }) {
        const body = {
            model,
            [tokenLimit]: PING_TOKENS,
            messages: [{ role: 'user', content: 'Hi' }]
        };
        const signal = AbortSignal.timeout(TIMEOUT_MS);
        return pingResult(await chat(apiKey, baseUrl, body, signal));
    }

    function start({ apiKey, model, baseUrl, system, tools, messages }) {
        const history = [
            { role: 'system', content: system },
            ...messages
                .filter((m) => m.text)
                .map((m) => ({ role: m.role, content: m.text }))
        ];
        const definitions = tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
            }
        }));
        // Some servers send no call ids.
        let unnamed = 0;

        return {
            async step({ onText, signal }) {
                const body = {
                    model,
                    stream: true,
                    tools: definitions,
                    messages: history
                };
                const response = await openReply(
                    label,
                    (abort) => chat(apiKey, baseUrl, body, abort),
                    signal
                );
                const reply = await readReply(response.body, label, onText);
                // Decided by the calls, not by finish_reason: some servers
                // finish with "stop" although they call tools.
                const notice = NOTICES[reply.finishReason];
                if (notice || reply.calls.length === 0) {
                    return { toolCalls: [], notice };
                }
                const toolCalls = reply.calls.map(({ id, name, json }) => ({
                    id: id || `call_${++unnamed}`,
                    name,
                    args: argsOf(json)
                }));
                history.push(askedFor(reply.text, toolCalls));
                return { toolCalls, notice };
            },
            addToolResults(results) {
                history.push(
                    ...results.map((r) => ({
                        role: 'tool',
                        tool_call_id: r.id,
                        content: r.isError ? `Error: ${r.text}` : r.text
                    }))
                );
            }
        };
    }

    return { LABEL: label, ping, start };
}

// GET <baseUrl>/models, never with a key -> the model ids. Throws with a message
// for the user.
async function listModels(baseUrl) {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await request(baseUrl, '/models', '', { signal });
    if (!response.ok) {
        const message = await errorOf(response);
        throw new Error(`The server returned ${response.status}: ${message}`);
    }
    const body = await response.json().catch(() => null);
    if (!Array.isArray(body?.data)) {
        throw new Error('The server did not answer GET /models with a list');
    }
    return body.data.map((m) => m.id).filter((id) => typeof id === 'string');
}

module.exports = {
    openai: openAiAdapter({
        label: 'OpenAI',
        url: OPENAI_URL,
        tokenLimit: 'max_completion_tokens'
    }),
    compatible: openAiAdapter({ label: 'OpenAI-compatible' }),
    local: openAiAdapter({ label: 'Local model' }),
    listModels
};
