/** @jest-environment node */
// Console chips on a chat turn: what of a line or a result reaches the model.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { saveModelSettings } = require('../../services/aiModel');
const { setAiAccess } = require('../../services/aiAccess');
const { setHiddenFields } = require('../../services/hiddenFields');
const { createTestHash, deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const answer = fs.readFileSync(
    path.join(__dirname, '../fixtures/anthropic/answer.sse')
);

describe('AI chat Console chips', () => {
    const app = createApp();
    let provider;

    beforeEach(() => {
        db.prepare('DELETE FROM ai_model').run();
        saveModelSettings({
            mode: 'api',
            provider: 'anthropic',
            model: 'claude-opus-5-5',
            apiKey: 'sk-ant-api03-fake-key-for-tests-9F2c'
        });
        provider = jest
            .spyOn(global, 'fetch')
            .mockImplementation(async () => new Response(answer));
    });
    afterEach(() => {
        provider.mockRestore();
        setHiddenFields(['password', 'token', 'secret']);
        setAiAccess(CONN, { keys: true, values: true });
    });
    afterAll(() => db.prepare('DELETE FROM ai_model').run());

    const post = (chip) =>
        request(app)
            .post('/api/ai-chat')
            .send({
                chatId: 'chat-console',
                connectionId: CONN,
                messages: [{ role: 'user', text: 'Explain', chips: [chip] }]
            });

    /** Sends a question with the chip; -> the text and request the model got. */
    async function ask(chip) {
        await post(chip).expect(200);
        const body = JSON.parse(provider.mock.calls.at(-1)[1].body);
        const [{ content }] = body.messages;
        const text =
            typeof content === 'string'
                ? content
                : content.map((c) => c.text).join('');
        return { text, body };
    }

    it('sends the text of a line chip, and offers no command tool', async () => {
        const { text, body } = await ask({
            kind: 'line',
            connectionId: CONN,
            line: 3,
            text: 'HGETALL user:1',
            tabId: 1,
            tabName: 'console-1.redis'
        });

        expect(text).toContain('Console line 3');
        expect(text).toContain('"HGETALL user:1"');
        expect(text).not.toContain('console-1.redis');
        const tools = body.tools.map((t) => t.name);
        expect(tools).toContain('get_key');
        expect(tools.filter((n) => /command|console|exec/i.test(n))).toEqual(
            []
        );
    });

    /** What the model gets for the result of `command`. */
    const resultText = async (command, reply, resultKind = 'array') =>
        (
            await ask({
                kind: 'result',
                connectionId: CONN,
                line: 1,
                text: command,
                resultKind,
                reply
            })
        ).text;

    it('masks hidden fields in a flat HGETALL reply', async () => {
        const text = await resultText('HGETALL user:1', [
            'name',
            'Ada',
            'Password',
            'hunter2'
        ]);

        expect(text).toContain('Ada');
        expect(text).toContain('●●●');
        expect(text).not.toContain('hunter2');
    });

    // The secret is "hunter2" throughout; `password` is a hidden field.
    it.each([
        // [command, reply]
        ['HGET user:1 password', 'hunter2'],
        ['hget user:1 "PASSWORD"', 'hunter2'],
        ['HGETALL user:1', [['password', 'hunter2']]],
        ['HGETALL user:1', { password: 'hunter2' }],
        ['HGETALL user:1', ['profile', '{"password":"hunter2"}']],
        ['HGET user:1 profile', 'a:1:{s:8:"password";s:7:"hunter2";}'],
        ['GET user:1', '{"a":[{"password":"hunter2"}]}'],
        ['GET user:1', '{"password":"hunter2"'],
        ['GET user:1', 'user=ada&password=hunter2'],
        ['GET user:1', 'O:4:"User":1:{s:2:"pw";s:7:"hunter2";}'],
        ['GET session:1', 'id|i:1;pw|s:7:"hunter2";'],
        ['SET user:1 x GET', '{"password":"hunter2"}'],
        ['LRANGE l 0 -1', ['password', 'hunter2']],
        ['ZRANGE z 0 -1 WITHSCORES', [['{"password":"hunter2"}', '1']]],
        ['CONFIG GET *', ['requirepass', 'hunter2']],
        ['CONFIG GET *', ['masterauth', 'hunter2']],
        // not understood, so withheld
        ['SLOWLOG GET', [[1, 2, 3, ['AUTH', 'hunter2']]]],
        ['CLIENT LIST', 'id=1 user=hunter2'],
        ['SMEMBERS s', ['hunter2']],
        ['HGETALL user:1', ['password', 'x', 'hunter2']],
        ['TTL user:1', ['hunter2']]
    ])('never shows a hidden value: %s %j', async (command, reply) => {
        expect(await resultText(command, reply)).not.toContain('hunter2');
    });

    it('withholds an error that mentions a hidden field', async () => {
        const text = await resultText(
            'HSET user:1 password',
            "ERR wrong arguments near 'password' 'hunter2'",
            'error'
        );

        expect(text).not.toContain('hunter2');
    });

    it.each([
        ['GET greeting', 'hello', 'bulk', '"hello"'],
        ['HGET user:1 name', 'Ada', 'bulk', '"Ada"'],
        ['TTL user:1', 120, 'integer', '120'],
        ['KEYS user:*', ['user:1'], 'array', '["user:1"]'],
        ['SCAN 0', ['0', ['user:1']], 'array', '["0",["user:1"]]'],
        [
            'CONFIG GET maxmemory',
            ['maxmemory', '0'],
            'array',
            '[["maxmemory","0"]]'
        ],
        [
            'GET user:1',
            '{"name":"Ada","token":"hunter2"}',
            'bulk',
            JSON.stringify('{"name":"Ada","token":"●●●"}')
        ],
        ['HGET user:1 x', 'WRONGTYPE Operation', 'error', 'WRONGTYPE']
    ])('keeps what is safe: %s', async (command, reply, kind, expected) => {
        expect(await resultText(command, reply, kind)).toContain(expected);
    });

    it('uses the hidden fields as they are now', async () => {
        setHiddenFields(['ssn']);

        const text = await resultText('HGETALL u', ['SSN', '123-45', 'a', 'b']);

        expect(text).not.toContain('123-45');
    });

    it('sends no result while See values is off', async () => {
        setAiAccess(CONN, { values: false });

        const text = await resultText('GET greeting', 'hello', 'bulk');

        expect(text).toContain('"GET greeting"');
        expect(text).toContain('See values');
        expect(text).not.toContain('hello');
    });

    it('sends no result of a Connection that is gone', async () => {
        const { text } = await ask({
            kind: 'result',
            connectionId: 'no-such-connection',
            line: 1,
            text: 'GET greeting',
            resultKind: 'bulk',
            reply: 'hello'
        });

        expect(text).not.toContain('hello');
    });

    it('cuts a long result', async () => {
        const text = await resultText('GET big', 'y'.repeat(20_000), 'bulk');

        expect(text.length).toBeLessThan(4500);
        expect(text).toContain('(cut)');
    });

    it('says when the browser left a large reply out', async () => {
        const text = await resultText('GET big', undefined, 'bulk');

        expect(text).toContain('too large');
    });

    it('masks a real HGETALL run from the Console', async () => {
        await createTestHash('test:chatmask:user', {
            name: 'Ada',
            password: 'hunter2'
        });
        const run = await request(app)
            .post(`/api/console/run?env=${CONN}`)
            .send({
                statements: [{ line: 1, text: 'HGETALL test:chatmask:user' }]
            })
            .expect(200);
        const [{ text: command, reply, kind }] = run.body.results;

        const text = await resultText(command, reply, kind);

        expect(text).toContain('Ada');
        expect(text).not.toContain('hunter2');
        await deleteTestKeys('test:chatmask:*');
    });

    it.each([
        ['no line number', { line: 0, resultKind: 'bulk' }],
        ['an unknown kind', { line: 1, resultKind: 'weird' }]
    ])('refuses a result chip with %s', async (_, fields) => {
        await post({
            kind: 'result',
            connectionId: CONN,
            text: 'GET k',
            reply: 'v',
            ...fields
        }).expect(400);
    });
});
