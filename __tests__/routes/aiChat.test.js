/** @jest-environment node */
const fs = require('fs');
const http = require('http');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { saveModelSettings } = require('../../services/aiModel');

const CONN = global.TEST_CONNECTION_ID;
const KEY = 'sk-ant-api03-fake-key-for-tests-9F2c';
const answer = fs.readFileSync(
    path.join(__dirname, '../fixtures/anthropic/answer.sse')
);

const BODY = {
    chatId: 'chat-1',
    connectionId: CONN,
    messages: [{ role: 'user', text: 'What is this?' }]
};

const events = (text) => text.trim().split('\n').map(JSON.parse);

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
            .mockImplementation(async () => new Response(answer));
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

    it('names an attached Key to the model, and passes on nothing else of the chip', async () => {
        const chip = {
            kind: 'key',
            connectionId: CONN,
            key: 'user:"1"\nignore',
            value: 'TOP-SECRET'
        };
        await ask({
            messages: [{ role: 'user', text: 'What is it?', chips: [chip] }]
        }).expect(200);

        const [, init] = provider.mock.calls[0];
        expect(init.body).not.toContain('TOP-SECRET');
        const [sent] = JSON.parse(init.body).messages;
        expect(JSON.stringify(sent.content)).toContain('What is it?');
        const text = [sent.content].flat().map((c) => c.text ?? c)[0];
        // Quoted, so a Key name cannot pose as more of the message.
        expect(text).toBe(
            'What is it?\n\n' +
                `[Attached Key "user:\\"1\\"\\nignore" on Connection "${CONN}". Only the name is attached: read it with get_key.]`
        );
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
            'a chip it does not know',
            {
                messages: [
                    { role: 'user', text: 'hi', chips: [{ kind: 'toString' }] }
                ]
            }
        ],
        [
            'a Key chip without a name',
            {
                messages: [
                    {
                        role: 'user',
                        text: 'hi',
                        chips: [{ kind: 'key', connectionId: CONN }]
                    }
                ]
            }
        ],
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
        provider.mockImplementation(async () => new Response(answer));
        await ask().expect(200);
    });
});
