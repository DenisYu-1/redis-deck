/** @jest-environment node */
const fs = require('fs');
const http = require('http');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { saveModelSettings } = require('../../services/aiModel');
const { setAiAccess } = require('../../services/aiAccess');
const { listActivity } = require('../../services/aiActivity');
const { keyExists, deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const KEY = 'sk-ant-api03-fake-key-for-tests-9F2c';
const answerSse = fs.readFileSync(
    path.join(__dirname, '../fixtures/anthropic/answer.sse')
);

const BODY = {
    chatId: 'chat-1',
    connectionId: CONN,
    messages: [{ role: 'user', text: 'What is this?' }]
};

const events = (text) => text.trim().split('\n').map(JSON.parse);

const WRITTEN = 'test:ai:route';

// A reply asking for one write, as the Messages API streams it.
const writeCall = () =>
    [
        {
            type: 'content_block_start',
            index: 0,
            content_block: {
                type: 'tool_use',
                id: 'toolu_1',
                name: 'set_key',
                input: {}
            }
        },
        {
            type: 'content_block_delta',
            index: 0,
            delta: {
                type: 'input_json_delta',
                partial_json: JSON.stringify({
                    connectionId: CONN,
                    key: WRITTEN,
                    value: 'x'
                })
            }
        },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
        { type: 'message_stop' }
    ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('');

// Starts a turn over real HTTP, so it can be answered while it streams.
// -> { next(state) -> its next approval card in that state, ended, leave() }
function openTurn(port) {
    const seen = [];
    let arrived = () => {};
    let done;
    const ended = new Promise((resolve) => (done = resolve));
    const browser = http.request(
        {
            port,
            method: 'POST',
            path: '/api/ai-chat',
            headers: { 'content-type': 'application/json' }
        },
        (res) => {
            let buffer = '';
            res.on('data', (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop();
                seen.push(...lines.map((line) => JSON.parse(line)));
                arrived();
            });
            res.on('end', () => done(seen));
        }
    );
    browser.on('error', () => {});
    browser.end(JSON.stringify(BODY));
    async function next(state) {
        for (;;) {
            const card = seen.find((e) => e.state === state);
            if (card) return card;
            await new Promise((resolve) => (arrived = resolve));
        }
    }
    return { next, ended, leave: () => browser.destroy() };
}

describe('AI chat route', () => {
    const app = createApp();
    let provider;

    const ask = (body) =>
        request(app)
            .post('/api/ai-chat')
            .send({ ...BODY, ...body });

    beforeEach(() => {
        db.prepare('DELETE FROM ai_model').run();
        saveModelSettings({
            mode: 'api',
            provider: 'anthropic',
            model: 'claude-opus-5-5',
            apiKey: KEY
        });
        provider = jest
            .spyOn(global, 'fetch')
            .mockImplementation(async () => new Response(answerSse));
    });
    afterEach(() => provider.mockRestore());
    afterAll(() => db.prepare('DELETE FROM ai_model').run());

    it('streams the turn of the saved model, one JSON event a line', async () => {
        const res = await ask().expect(200);

        expect(res.headers['content-type']).toContain('application/x-ndjson');
        expect(events(res.text)).toEqual([
            { type: 'text', text: 'It is a hash.' },
            { type: 'done' }
        ]);
        const [, init] = provider.mock.calls[0];
        expect(init.headers['x-api-key']).toBe(KEY);
        expect(JSON.parse(init.body).model).toBe('claude-opus-5-5');
    });

    it('takes a transcript larger than the default body limit', async () => {
        const long = { role: 'user', text: 'x'.repeat(300_000) };
        await ask({ messages: [long] }).expect(200);
    });

    it('keeps the key out of a provider error', async () => {
        provider.mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({ error: { message: `bad key ${KEY}` } }),
                    { status: 401 }
                )
        );
        const res = await ask().expect(200);

        expect(res.text).not.toContain(KEY);
        expect(events(res.text)[0]).toEqual({
            type: 'error',
            message: 'Anthropic returned 401: bad key ●●●'
        });
    });

    it('says when no model is set up', async () => {
        db.prepare('DELETE FROM ai_model').run();
        const res = await ask().expect(400);

        expect(res.body.error).toBe('No model is set up yet');
        expect(provider).not.toHaveBeenCalled();
    });

    it.each([
        ['no chat id', { chatId: '' }],
        ['an unknown Connection', { connectionId: 'nope' }],
        ['no messages', { messages: [] }],
        ['a role it does not know', { messages: [{ role: 'system' }] }],
        [
            'an answer as the last message',
            { messages: [{ role: 'assistant', text: 'hi' }] }
        ]
    ])('refuses %s', async (_, body) => {
        const res = await ask(body).expect(400);
        expect(res.body.error).toEqual(expect.any(String));
        expect(provider).not.toHaveBeenCalled();
    });

    it('runs one turn per chat at a time, and stops it when the browser leaves', async () => {
        let aborted;
        const left = new Promise((resolve) => (aborted = resolve));
        let reached;
        const asking = new Promise((resolve) => (reached = resolve));
        // A provider that never answers.
        provider.mockImplementation(
            (url, { signal }) =>
                new Promise((resolve, reject) => {
                    reached();
                    signal.addEventListener('abort', () => {
                        aborted();
                        reject(signal.reason);
                    });
                })
        );
        const server = app.listen(0);
        const browser = http.request({
            port: server.address().port,
            method: 'POST',
            path: '/api/ai-chat',
            headers: { 'content-type': 'application/json' }
        });
        browser.on('error', () => {});
        browser.end(JSON.stringify(BODY));
        await asking;

        const second = await ask().expect(409);
        expect(second.body.error).toMatch(/still answering/);

        browser.destroy();
        await left;
        await new Promise((resolve) => server.close(resolve));
        provider.mockImplementation(async () => new Response(answerSse));
        await ask().expect(200);
    });

    describe('approval answers', () => {
        let server;
        let port;
        const answer = (body) =>
            request(app).post('/api/ai-chat/approvals').send(body);

        beforeEach(async () => {
            db.prepare('DELETE FROM ai_activity').run();
            setAiAccess(CONN, { write: true, ask: true });
            await deleteTestKeys(WRITTEN, CONN);
            provider
                .mockImplementationOnce(async () => new Response(writeCall()))
                .mockImplementation(async () => new Response(answerSse));
            server = app.listen(0);
            port = server.address().port;
        });
        afterEach(
            () => new Promise((resolve) => server.close(() => resolve()))
        );

        it('runs the write once approved, and the turn goes on', async () => {
            const turn = openTurn(port);
            const card = await turn.next('pending');

            const reply = { chatId: BODY.chatId, id: card.id, approved: true };
            await answer(reply).expect(200);

            const all = await turn.ended;
            expect(all.slice(-2)).toEqual([
                { type: 'text', text: 'It is a hash.' },
                { type: 'done' }
            ]);
            expect(await keyExists(WRITTEN, CONN)).toBe(true);
            // Nothing waits for it any more.
            await answer(reply).expect(404);
        });

        it('denies what still waits when the browser leaves', async () => {
            const turn = openTurn(port);
            const card = await turn.next('pending');

            turn.leave();
            while (listActivity({}).total === 0) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            expect(listActivity({}).counts).toMatchObject({ denied: 1 });
            expect(await keyExists(WRITTEN, CONN)).toBe(false);
            await answer({
                chatId: BODY.chatId,
                id: card.id,
                approved: true
            }).expect(404);
        });

        it.each([
            ['no card id', { chatId: 'chat-1', approved: true }],
            ['no chat id', { id: 'x', approved: true }],
            ['no yes or no', { chatId: 'chat-1', id: 'x' }]
        ])('refuses an answer with %s', async (_, body) => {
            await answer(body).expect(400);
        });
    });
});
