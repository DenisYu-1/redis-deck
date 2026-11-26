/** @jest-environment node */
// Request and response mapping of the Anthropic adapter. The fixtures follow
// the documented Messages streaming events; no network.
const fs = require('fs');
const path = require('path');
const anthropic = require('../../services/ai/anthropic');

const KEY = 'sk-ant-api03-fake-key-for-tests';
const fixture = (name) =>
    fs.readFileSync(path.join(__dirname, '../fixtures/anthropic', name));

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

const TOOLS = [
    {
        name: 'get_key',
        description: 'Read one Key',
        inputSchema: { type: 'object', properties: { key: {} } },
        annotations: { readOnlyHint: true }
    }
];

const start = (messages = [{ role: 'user', text: 'What is user:1?' }]) =>
    anthropic.start({
        apiKey: KEY,
        model: 'claude-sonnet-5-5',
        system: 'Be brief.',
        tools: TOOLS,
        messages
    });

describe('Anthropic adapter', () => {
    let provider;
    beforeEach(() => {
        provider = jest.spyOn(global, 'fetch');
    });
    afterEach(() => provider.mockRestore());

    const sent = (call) => JSON.parse(provider.mock.calls[call][1].body);

    const step = async (conversation) => {
        const text = [];
        const result = await conversation.step({
            onText: (chunk) => text.push(chunk)
        });
        return { ...result, text };
    };

    it('sends the transcript and tools, and streams text and tool calls back', async () => {
        provider.mockResolvedValueOnce(streamed(fixture('tool-use.sse')));
        const result = await step(
            start([
                { role: 'user', text: 'hi' },
                { role: 'assistant', text: 'Hello.' },
                { role: 'assistant', text: '' },
                { role: 'user', text: 'What is user:1?' }
            ])
        );

        const [url, init] = provider.mock.calls[0];
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect(init.headers).toEqual({
            'x-api-key': KEY,
            'anthropic-version': '2026-10-21',
            'content-type': 'application/json'
        });
        expect(sent(0)).toEqual({
            model: 'claude-sonnet-5-5',
            max_tokens: 16000,
            stream: true,
            system: 'Be brief.',
            tools: [
                {
                    name: 'get_key',
                    description: 'Read one Key',
                    input_schema: TOOLS[0].inputSchema
                }
            ],
            messages: [
                { role: 'user', content: 'hi' },
                { role: 'assistant', content: 'Hello.' },
                { role: 'user', content: 'What is user:1?' }
            ]
        });
        expect(result).toEqual({
            text: ['Let me ', 'look — one moment.'],
            toolCalls: [
                {
                    id: 'toolu_01B',
                    name: 'get_key',
                    args: { connectionId: 'local', key: 'user:1' }
                },
                { id: 'toolu_01C', name: 'list_connections', args: {} }
            ],
            notice: undefined
        });
    });

    it('sends the reply back unchanged with the tool results', async () => {
        provider
            .mockResolvedValueOnce(streamed(fixture('tool-use.sse')))
            .mockResolvedValueOnce(streamed(fixture('answer.sse'), 1000));
        const conversation = start();
        await step(conversation);
        conversation.addToolResults([
            { id: 'toolu_01B', text: '{"type":"hash"}', isError: false },
            { id: 'toolu_01C', text: 'tool is turned off', isError: true }
        ]);
        const result = await step(conversation);

        expect(sent(1).messages.slice(1)).toEqual([
            {
                role: 'assistant',
                content: [
                    {
                        type: 'thinking',
                        thinking: '',
                        signature: 'EqQBCgIYAhIm'
                    },
                    { type: 'text', text: 'Let me look — one moment.' },
                    {
                        type: 'tool_use',
                        id: 'toolu_01B',
                        name: 'get_key',
                        input: { connectionId: 'local', key: 'user:1' }
                    },
                    {
                        type: 'tool_use',
                        id: 'toolu_01C',
                        name: 'list_connections',
                        input: {}
                    }
                ]
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'toolu_01B',
                        content: '{"type":"hash"}',
                        is_error: false
                    },
                    {
                        type: 'tool_result',
                        tool_use_id: 'toolu_01C',
                        content: 'tool is turned off',
                        is_error: true
                    }
                ]
            }
        ]);
        expect(result).toMatchObject({
            text: ['It is a hash.'],
            toolCalls: []
        });
    });

    const stopping = (reason) =>
        streamed(
            Buffer.from(
                fixture('answer.sse').toString().replace('end_turn', reason)
            ),
            1000
        );

    it.each([
        ['max_tokens', 'The answer was cut off at the length limit.'],
        ['refusal', 'The model declined to answer.']
    ])('says so when the reply stops with %s', async (reason, notice) => {
        provider.mockResolvedValue(stopping(reason));
        expect(await step(start())).toMatchObject({ toolCalls: [], notice });
    });

    it.each([
        [
            'an HTTP error',
            () =>
                new Response(
                    JSON.stringify({
                        type: 'error',
                        error: { message: 'invalid x-api-key' }
                    }),
                    { status: 401 }
                ),
            'Anthropic returned 401: invalid x-api-key'
        ],
        [
            'an error event in the stream',
            () =>
                streamed(
                    Buffer.from(
                        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'
                    )
                ),
            'Anthropic: Overloaded'
        ],
        [
            'a stream that ends early',
            () => streamed(fixture('answer.sse').subarray(0, 200)),
            'Anthropic closed the reply before it was complete'
        ]
    ])('fails on %s', async (_, reply, message) => {
        provider.mockResolvedValue(reply());
        await expect(step(start())).rejects.toThrow(message);
    });

    it('names the cause when Anthropic cannot be reached', async () => {
        provider.mockRejectedValue(
            new TypeError('fetch failed', {
                cause: new Error('getaddrinfo ENOTFOUND api.anthropic.com')
            })
        );
        await expect(step(start())).rejects.toThrow(
            'Could not reach Anthropic: getaddrinfo ENOTFOUND api.anthropic.com'
        );
    });
});
