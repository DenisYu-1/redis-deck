/** @jest-environment node */
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');

const KEY = 'sk-ant-api03-fake-key-for-tests-9F2c';
const SETTINGS = {
    mode: 'api',
    provider: 'anthropic',
    model: 'claude-opus-5-5'
};

describe('AI model routes', () => {
    const app = createApp();

    beforeEach(() => db.prepare('DELETE FROM ai_model').run());
    afterAll(() => db.prepare('DELETE FROM ai_model').run());

    const save = (body) =>
        request(app)
            .put('/api/ai-model')
            .send({ ...SETTINGS, ...body });

    it('starts with a default model and no key', async () => {
        const { body } = await request(app).get('/api/ai-model').expect(200);
        expect(body).toEqual({
            mode: 'api',
            provider: 'anthropic',
            model: 'claude-sonnet-5-5',
            models: [
                'claude-opus-5-5',
                'claude-sonnet-5-5',
                'claude-haiku-5-5'
            ],
            keyLast4: null
        });
    });

    it('saves the settings and answers with the last four characters only', async () => {
        const put = await save({ apiKey: `  ${KEY}\n` }).expect(200);
        const get = await request(app).get('/api/ai-model').expect(200);

        for (const res of [put, get]) {
            expect(res.body).toMatchObject({ ...SETTINGS, keyLast4: '9F2c' });
            expect(res.text).not.toContain('fake-key');
        }
    });

    it('keeps the stored key when none is typed', async () => {
        await save({ apiKey: KEY }).expect(200);
        await save({ model: 'claude-haiku-5-5' }).expect(200);
        const { body } = await save({
            model: 'claude-haiku-5-5',
            apiKey: ''
        }).expect(200);

        expect(body).toMatchObject({
            model: 'claude-haiku-5-5',
            keyLast4: '9F2c'
        });
    });

    it('never answers with the whole of a very short key', async () => {
        const { body } = await save({ apiKey: 'abcd' }).expect(200);
        expect(body.keyLast4).toBe('');
    });

    it.each([
        ['an unknown mode', { mode: 'agent' }],
        ['an unknown provider', { provider: 'openai' }],
        ['a model outside the list', { model: 'claude-2' }],
        ['a key with a line break', { apiKey: 'sk-ant-one\nsk-ant-two' }],
        ['a key that is not text', { apiKey: 42 }]
    ])('refuses %s without echoing the key', async (_, body) => {
        const res = await save(body).expect(400);
        expect(res.body.error).toEqual(expect.any(String));
        expect(res.text).not.toContain('sk-ant-one');
    });

    describe('Test', () => {
        let provider;
        beforeEach(() => {
            provider = jest.spyOn(global, 'fetch');
        });
        afterEach(() => provider.mockRestore());

        const reply = (status, body) =>
            provider.mockResolvedValue(
                new Response(JSON.stringify(body), { status })
            );
        const run = (body) =>
            request(app)
                .post('/api/ai-model/test')
                .send({ ...SETTINGS, ...body })
                .expect(200);

        it('makes one minimal call with the typed key and saves nothing', async () => {
            reply(200, { type: 'message', content: [] });
            const { body } = await run({ apiKey: KEY });

            expect(body).toEqual({
                ok: true,
                title: expect.stringMatching(/^Anthropic replied in \d+ ms$/),
                detail: 'Model claude-opus-5-5 with tool use.'
            });
            expect(provider).toHaveBeenCalledTimes(1);
            const [url, init] = provider.mock.calls[0];
            expect(url).toBe('https://api.anthropic.com/v1/messages');
            expect(init.method).toBe('POST');
            expect(init.headers).toMatchObject({
                'x-api-key': KEY,
                'anthropic-version': '2026-10-21',
                'content-type': 'application/json'
            });
            expect(JSON.parse(init.body)).toEqual({
                model: 'claude-opus-5-5',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            });
            const after = await request(app).get('/api/ai-model');
            expect(after.body.keyLast4).toBeNull();
        });

        it('uses the stored key when none is typed', async () => {
            await save({ apiKey: KEY });
            reply(200, {});
            const { body } = await run({});

            expect(body.ok).toBe(true);
            expect(provider.mock.calls[0][1].headers['x-api-key']).toBe(KEY);
        });

        it('reports the provider’s error without the key', async () => {
            reply(401, {
                type: 'error',
                error: {
                    type: 'authentication_error',
                    message: `invalid x-api-key ${KEY}`
                }
            });
            const res = await run({ apiKey: KEY });

            expect(res.body).toEqual({
                ok: false,
                title: 'Anthropic returned 401',
                detail: 'invalid x-api-key ●●●'
            });
            expect(res.text).not.toContain(KEY);
        });

        it('copes with an error that is not JSON', async () => {
            provider.mockResolvedValue(
                new Response('<html>', {
                    status: 502,
                    statusText: 'Bad Gateway'
                })
            );
            const { body } = await run({ apiKey: KEY });

            expect(body).toEqual({
                ok: false,
                title: 'Anthropic returned 502',
                detail: 'Bad Gateway'
            });
        });

        it('reports a provider that cannot be reached without the key', async () => {
            provider.mockRejectedValue(
                new TypeError('fetch failed', {
                    cause: new Error(`getaddrinfo ENOTFOUND ${KEY}`)
                })
            );
            const res = await run({ apiKey: KEY });

            expect(res.body).toEqual({
                ok: false,
                title: 'Could not reach Anthropic',
                detail: 'getaddrinfo ENOTFOUND ●●●'
            });
            expect(res.text).not.toContain(KEY);
        });

        it('says there is no key without calling the provider', async () => {
            const { body } = await run({});

            expect(body).toEqual({
                ok: false,
                title: 'No API key',
                detail: 'Paste a key, then test again.'
            });
            expect(provider).not.toHaveBeenCalled();
        });
    });
});
