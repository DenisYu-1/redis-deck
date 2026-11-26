/** @jest-environment node */
import { streamAiChat, type ChatEvent } from '@/services/aiChat';

const REQUEST = {
    chatId: 'c',
    connectionId: 'local',
    messages: [{ role: 'user' as const, text: 'hi' }]
};

const chunked = (...chunks: string[]) =>
    new Response(
        new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(new TextEncoder().encode(chunk));
                }
                controller.close();
            }
        })
    );

const run = async (reply: Response) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(reply);
    const events: ChatEvent[] = [];
    await streamAiChat(REQUEST, {
        signal: new AbortController().signal,
        onEvent: (event) => events.push(event)
    });
    return events;
};

afterEach(() => jest.restoreAllMocks());

test('reads one event per line, however the bytes are cut', async () => {
    const events = await run(
        chunked('{"type":"text","te', 'xt":"a"}\n{"type":"done"}\n')
    );
    expect(events).toEqual([{ type: 'text', text: 'a' }, { type: 'done' }]);
});

test('rejects with the server’s reason when the turn cannot run', async () => {
    const reply = new Response('{"error":"No model is set up yet"}', {
        status: 400
    });
    await expect(run(reply)).rejects.toThrow('No model is set up yet');
});

test('rejects when the stream is cut off', async () => {
    await expect(run(chunked('{"type":"text","text":"a"}\n'))).rejects.toThrow(
        'The connection to the server was lost'
    );
});
