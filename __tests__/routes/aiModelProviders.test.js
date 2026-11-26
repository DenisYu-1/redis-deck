/** @jest-environment node */
// The OpenAI, OpenAI-compatible and Local model choices of the model settings.
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');

const KEY = 'sk-fake-key-for-tests-7Qp1';
const OPENAI = { mode: 'api', provider: 'openai', model: 'gpt-test' };
const COMPATIBLE = {
    mode: 'api',
    provider: 'openai-compatible',
    model: 'mixtral',
    baseUrl: 'https://llm.example.com/v1'
};
const ANTHROPIC = {
    mode: 'api',
    provider: 'anthropic',
    model: 'claude-opus-5-5'
};
const LOCAL = {
    mode: 'local',
    localUrl: 'http://ollama.test:11434',
    localModel: 'llama3.1:8b'
};

describe('AI model providers', () => {
    const app = createApp();
    let server;

    beforeEach(() => {
        db.prepare('DELETE FROM ai_model').run();
        server = jest.spyOn(global, 'fetch');
    });
    afterEach(() => server.mockRestore());
    afterAll(() => db.prepare('DELETE FROM ai_model').run());

    const put = (body) => request(app).put('/api/ai-model').send(body);
    const save = async (body) => (await put(body).expect(200)).body;
    const read = async () => (await request(app).get('/api/ai-model')).body;
    const run = async (body) =>
        (await request(app).post('/api/ai-model/test').send(body).expect(200))
            .body;
    const reply = (status, body) =>
        server.mockImplementation(
            async () => new Response(JSON.stringify(body), { status })
        );

    it('saves OpenAI with a model id of the user’s choosing', async () => {
        const saved = await save({ ...OPENAI, apiKey: KEY });
        expect(saved).toMatchObject({
            ...OPENAI,
            baseUrl: '',
            keyLast4: '7Qp1',
            ready: true
        });
    });

    it('saves an OpenAI-compatible server with its Base URL', async () => {
        const saved = await save({
            ...COMPATIBLE,
            baseUrl: ' https://LLM.example.com/v1/ ',
            apiKey: KEY
        });
        expect(saved).toMatchObject({ ...COMPATIBLE, keyLast4: '7Qp1' });
    });

    it.each([
        ['no model id', { ...OPENAI, model: ' ' }],
        ['no Base URL', { ...COMPATIBLE, baseUrl: '' }],
        [
            'a Base URL that is not http',
            { ...COMPATIBLE, baseUrl: 'file:///x' }
        ],
        [
            'a Base URL with a password in it',
            { ...COMPATIBLE, baseUrl: 'https://me:hunter2@llm.example.com' }
        ],
        [
            'a Base URL with a query',
            { ...COMPATIBLE, baseUrl: 'https://llm.example.com/v1?hunter2' }
        ],
        ['no server URL', { ...LOCAL, localUrl: '' }],
        ['a server URL that is not one', { ...LOCAL, localUrl: 'ollama' }],
        ['no local model', { ...LOCAL, localModel: '' }]
    ])('refuses %s', async (_, body) => {
        const res = await put(body).expect(400);
        expect(res.body.error).toEqual(expect.any(String));
        expect(res.text).not.toContain('hunter2');
    });

    describe('the stored key', () => {
        it.each([
            ['another provider', ANTHROPIC, OPENAI],
            ['another Base URL', COMPATIBLE, 'https://other.example.com/v1'],
            ['another path of the host', COMPATIBLE, 'https://llm.example.com']
        ])('is not reused for %s', async (_, stored, next) => {
            const other =
                typeof next === 'string' ? { ...stored, baseUrl: next } : next;
            await save({ ...stored, apiKey: KEY });

            expect(await run(other)).toMatchObject({
                ok: false,
                title: 'No API key'
            });
            expect(server).not.toHaveBeenCalled();
            expect(await save(other)).toMatchObject({
                keyLast4: null,
                ready: false
            });
        });

        it('is kept for the same Base URL', async () => {
            await save({ ...COMPATIBLE, apiKey: KEY });
            const saved = await save({
                ...COMPATIBLE,
                baseUrl: `${COMPATIBLE.baseUrl}/`,
                model: 'other'
            });
            expect(saved.keyLast4).toBe('7Qp1');
        });

        it('survives a switch to the Local model and back', async () => {
            await save({ ...COMPATIBLE, apiKey: KEY });
            const local = await save(LOCAL);
            expect(local).toMatchObject({
                ...LOCAL,
                provider: 'openai-compatible',
                model: 'mixtral',
                baseUrl: COMPATIBLE.baseUrl,
                keyLast4: '7Qp1',
                ready: true
            });
            expect(await save(COMPATIBLE)).toMatchObject({
                mode: 'api',
                localUrl: LOCAL.localUrl,
                localModel: LOCAL.localModel,
                keyLast4: '7Qp1'
            });
        });
    });

    describe('Test', () => {
        it.each([
            [OPENAI, 'https://api.openai.com/v1', 'OpenAI'],
            [COMPATIBLE, COMPATIBLE.baseUrl, 'OpenAI-compatible']
        ])('makes one call for %j', async (settings, url, label) => {
            reply(200, {});
            const result = await run({ ...settings, apiKey: KEY });

            expect(result).toEqual({
                ok: true,
                title: expect.stringMatching(
                    new RegExp(`^${label} replied in \\d+ ms$`)
                ),
                detail: `Model ${settings.model} with tool use.`
            });
            expect(server).toHaveBeenCalledTimes(1);
            const [called, init] = server.mock.calls[0];
            expect(called).toBe(`${url}/chat/completions`);
            expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
        });

        it('reports the provider’s error without the key', async () => {
            reply(401, { error: { message: `bad key ${KEY}` } });
            expect(await run({ ...OPENAI, apiKey: KEY })).toEqual({
                ok: false,
                title: 'OpenAI returned 401',
                detail: 'bad key ●●●'
            });
        });

        it('lists the models of the Local model, sending no key', async () => {
            await save({ ...OPENAI, apiKey: KEY });
            reply(200, { object: 'list', data: [{ id: 'a' }, { id: 'b' }] });
            const result = await run({ ...LOCAL, localModel: '' });

            expect(result).toEqual({
                ok: true,
                title: expect.stringMatching(
                    /^Local model answered in \d+ ms$/
                ),
                detail: 'It lists 2 models.',
                models: ['a', 'b']
            });
            expect(server).toHaveBeenCalledTimes(1);
            const [url, init] = server.mock.calls[0];
            expect(url).toBe('http://ollama.test:11434/v1/models');
            expect(init.method).toBe('GET');
            expect(init.headers).toEqual({});
        });

        it.each([
            [
                'a server without models',
                () => reply(200, { data: [] }),
                'The server lists no models.'
            ],
            [
                'a server that answers an error',
                () => reply(404, {}),
                expect.stringContaining('404')
            ],
            [
                'a server that is not there',
                () =>
                    server.mockRejectedValue(
                        new TypeError('fetch failed', {
                            cause: new Error('connect ECONNREFUSED')
                        })
                    ),
                'connect ECONNREFUSED'
            ]
        ])('reports %s', async (_, arrange, detail) => {
            arrange();
            expect(await run(LOCAL)).toMatchObject({ ok: false, detail });
        });
    });

    describe('POST /ai-model/models', () => {
        const models = (localUrl) =>
            request(app).post('/api/ai-model/models').send({ localUrl });

        it('fills the model select from GET /models under the URL given', async () => {
            reply(200, { data: [{ id: 'qwen' }] });
            const res = await models('http://box:1234/openai/v1/').expect(200);

            expect(res.body).toEqual({ models: ['qwen'] });
            expect(server.mock.calls[0][0]).toBe(
                'http://box:1234/openai/v1/models'
            );
        });

        it('says why it cannot', async () => {
            reply(200, { hello: 'world' });
            const res = await models('http://box:1234').expect(400);
            expect(res.body.error).toMatch(/GET \/models/);
        });
    });

    describe('chat', () => {
        const answer =
            'data: {"choices":[{"delta":{"content":"Hi."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
        const ask = () =>
            request(app)
                .post('/api/ai-chat')
                .send({
                    chatId: 'providers',
                    connectionId: global.TEST_CONNECTION_ID,
                    messages: [{ role: 'user', text: 'hello' }]
                })
                .expect(200);

        it.each([
            [
                'OpenAI',
                OPENAI,
                'https://api.openai.com/v1/chat/completions',
                `Bearer ${KEY}`,
                'gpt-test'
            ],
            [
                'an OpenAI-compatible server',
                COMPATIBLE,
                'https://llm.example.com/v1/chat/completions',
                `Bearer ${KEY}`,
                'mixtral'
            ],
            [
                'the Local model, without the stored key',
                LOCAL,
                'http://ollama.test:11434/v1/chat/completions',
                undefined,
                'llama3.1:8b'
            ]
        ])('runs on %s', async (_, settings, url, authorization, model) => {
            await save({ ...COMPATIBLE, apiKey: KEY });
            await save({ ...settings, apiKey: KEY });
            server.mockImplementation(async () => new Response(answer));

            const res = await ask();

            expect(res.text).toContain('"text":"Hi."');
            const [called, init] = server.mock.calls[0];
            expect(called).toBe(url);
            expect(init.headers.authorization).toBe(authorization);
            expect(JSON.parse(init.body).model).toBe(model);
        });
    });
});
