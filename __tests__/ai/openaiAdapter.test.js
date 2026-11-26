/** @jest-environment node */
// Request and response mapping of the OpenAI Chat Completions adapter. The
// fixtures follow the documented streaming chunks (and Ollama's); no network.
const fs = require('fs');
const path = require('path');
const adapters = require('../../services/ai/adapters');

const KEY = 'sk-fake-openai-key-for-tests';
const fixture = (name) =>
    fs.readFileSync(path.join(__dirname, '../fixtures/openai', name));

// A reply whose body arrives in small chunks, splitting events (and characters).
const streamed = (bytes, size = 7) =>
    new Response(
        new ReadableStream({
            start(controller) {
                for (let at = 0; at < bytes.length; at += size) {
                    controller.enqueue(bytes.subarray(at, at + size));
                }
                controller.close();
            }
        })
    );

const chunks = (...choices) =>
    streamed(
        Buffer.from(
            choices
                .map((c) => `data: ${JSON.stringify({ choices: [c] })}\n\n`)
                .join('')
        ),
        1000
    );

const TOOLS = [
    {
        name: 'get_key',
        description: 'Read one Key',
        inputSchema: { type: 'object', properties: { key: {} } },
        annotations: { readOnlyHint: true }
    }
];

const start = (provider = 'openai', request = {}) =>
    adapters[provider].start({
        apiKey: KEY,
        model: 'gpt-test',
        system: 'Be brief.',
        tools: TOOLS,
        messages: [{ role: 'user', text: 'What is user:1?' }],
        ...request
    });

describe('OpenAI Chat Completions adapter', () => {
    let server;
    beforeEach(() => {
        server = jest.spyOn(global, 'fetch');
    });
    afterEach(() => server.mockRestore());

    const sent = (call) => JSON.parse(server.mock.calls[call][1].body);

    const step = async (conversation) => {
        const text = [];
        const result = await conversation.step({
            onText: (chunk) => text.push(chunk)
        });
        return { ...result, text };
    };

    it('sends the transcript and tools, and streams text and tool calls back', async () => {
        server.mockResolvedValueOnce(streamed(fixture('tool-use.sse')));
        const result = await step(
            start('openai', {
                messages: [
                    { role: 'user', text: 'hi' },
                    { role: 'assistant', text: 'Hello.' },
                    { role: 'assistant', text: '' },
                    { role: 'user', text: 'What is user:1?' }
                ]
            })
        );

        const [url, init] = server.mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(init.headers).toEqual({
            authorization: `Bearer ${KEY}`,
            'content-type': 'application/json'
        });
        expect(init.redirect).toBe('error');
        expect(sent(0)).toEqual({
            model: 'gpt-test',
            stream: true,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'get_key',
                        description: 'Read one Key',
                        parameters: TOOLS[0].inputSchema
                    }
                }
            ],
            messages: [
                { role: 'system', content: 'Be brief.' },
                { role: 'user', content: 'hi' },
                { role: 'assistant', content: 'Hello.' },
                { role: 'user', content: 'What is user:1?' }
            ]
        });
        expect(result).toEqual({
            text: ['Let me ', 'look — one moment.'],
            toolCalls: [
                {
                    id: 'call_a',
                    name: 'get_key',
                    args: { connectionId: 'local', key: 'user:1' }
                },
                { id: 'call_b', name: 'list_connections', args: {} }
            ],
            notice: undefined
        });
    });

    it('sends the reply back with the tool results', async () => {
        server
            .mockResolvedValueOnce(streamed(fixture('tool-use.sse')))
            .mockResolvedValueOnce(streamed(fixture('answer.sse'), 1000));
        const conversation = start();
        await step(conversation);
        conversation.addToolResults([
            { id: 'call_a', text: '{"type":"hash"}', isError: false },
            { id: 'call_b', text: 'tool is turned off', isError: true }
        ]);
        const result = await step(conversation);

        expect(sent(1).messages.slice(2)).toEqual([
            {
                role: 'assistant',
                content: 'Let me look — one moment.',
                tool_calls: [
                    {
                        id: 'call_a',
                        type: 'function',
                        function: {
                            name: 'get_key',
                            arguments: '{"connectionId":"local","key":"user:1"}'
                        }
                    },
                    {
                        id: 'call_b',
                        type: 'function',
                        function: {
                            name: 'list_connections',
                            arguments: '{}'
                        }
                    }
                ]
            },
            {
                role: 'tool',
                tool_call_id: 'call_a',
                content: '{"type":"hash"}'
            },
            {
                role: 'tool',
                tool_call_id: 'call_b',
                content: 'Error: tool is turned off'
            }
        ]);
        expect(result).toMatchObject({
            text: ['It is a hash.'],
            toolCalls: []
        });
    });

    it('runs the tool calls of a server that sends no ids and stops with "stop"', async () => {
        server.mockResolvedValueOnce(streamed(fixture('ollama-tool-use.sse')));
        const { toolCalls } = await step(
            start('local', { apiKey: '', baseUrl: 'http://ollama:11434/v1' })
        );

        const [url, init] = server.mock.calls[0];
        expect(url).toBe('http://ollama:11434/v1/chat/completions');
        expect(init.headers).toEqual({ 'content-type': 'application/json' });
        expect(toolCalls).toEqual([
            { id: 'call_1', name: 'get_key', args: { key: 'user:1' } },
            { id: 'call_2', name: 'list_connections', args: {} }
        ]);
    });

    it('calls a tool without arguments when the model sends broken JSON', async () => {
        const call = {
            index: 0,
            id: 'call_x',
            function: { name: 'get_key', arguments: '{"key":' }
        };
        server.mockResolvedValue(
            chunks({
                delta: { tool_calls: [call] },
                finish_reason: 'tool_calls'
            })
        );
        const { toolCalls } = await step(start());
        expect(toolCalls).toEqual([
            { id: 'call_x', name: 'get_key', args: {} }
        ]);
    });

    it('sends to the Base URL of an OpenAI-compatible server', async () => {
        server.mockResolvedValue(streamed(fixture('answer.sse'), 1000));
        await step(
            start('openai-compatible', {
                baseUrl: 'https://llm.example.com/api/v1'
            })
        );

        const [url, init] = server.mock.calls[0];
        expect(url).toBe('https://llm.example.com/api/v1/chat/completions');
        expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    });

    it('never sends the OpenAI key anywhere but OpenAI', async () => {
        server.mockResolvedValue(streamed(fixture('answer.sse'), 1000));
        await step(start('openai', { baseUrl: 'https://evil.example.com' }));
        expect(server.mock.calls[0][0]).toBe(
            'https://api.openai.com/v1/chat/completions'
        );
    });

    it.each([
        ['length', 'The answer was cut off at the length limit.'],
        ['content_filter', 'The model declined to answer.']
    ])('says so when the reply stops with %s', async (reason, notice) => {
        server.mockResolvedValue(
            chunks({ delta: { content: 'Half' }, finish_reason: reason })
        );
        expect(await step(start())).toMatchObject({ toolCalls: [], notice });
    });

    it.each([
        [
            'an HTTP error',
            () =>
                new Response(
                    JSON.stringify({ error: { message: 'Incorrect API key' } }),
                    { status: 401 }
                ),
            'OpenAI returned 401: Incorrect API key'
        ],
        [
            'an error that is a plain string',
            () =>
                new Response(JSON.stringify({ error: 'model not found' }), {
                    status: 404
                }),
            'OpenAI returned 404: model not found'
        ],
        [
            'an error in the stream',
            () =>
                streamed(
                    Buffer.from('data: {"error":{"message":"Overloaded"}}\n\n')
                ),
            'OpenAI: Overloaded'
        ],
        [
            'a stream that ends early',
            () => streamed(fixture('answer.sse').subarray(0, 200)),
            'OpenAI closed the reply before it was complete'
        ]
    ])('fails on %s', async (_, reply, message) => {
        server.mockResolvedValue(reply());
        await expect(step(start())).rejects.toThrow(message);
    });

    it('names the cause when the server cannot be reached', async () => {
        server.mockRejectedValue(
            new TypeError('fetch failed', {
                cause: new Error('connect ECONNREFUSED')
            })
        );
        await expect(
            step(start('local', { baseUrl: 'http://ollama:11434/v1' }))
        ).rejects.toThrow('Could not reach Local model: connect ECONNREFUSED');
    });

    it.each([
        ['openai', 'max_completion_tokens'],
        ['openai-compatible', 'max_tokens']
    ])('pings %s with one small call', async (provider, limit) => {
        server.mockResolvedValue(new Response('{}'));
        const result = await adapters[provider].ping({
            apiKey: KEY,
            model: 'gpt-test',
            baseUrl: 'https://llm.example.com/v1'
        });

        expect(result).toEqual({ ok: true, status: 200 });
        expect(server).toHaveBeenCalledTimes(1);
        expect(sent(0)).toEqual({
            model: 'gpt-test',
            [limit]: 16,
            messages: [{ role: 'user', content: 'Hi' }]
        });
    });
});
