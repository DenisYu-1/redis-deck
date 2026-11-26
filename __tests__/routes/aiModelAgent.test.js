/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { AGENTS } = require('../../services/ai/agents');

const FAKE = path.join(__dirname, '../fixtures/agent/claude');
const SETTINGS = { mode: 'agent', agent: 'claude', agentPath: FAKE };

describe('AI model routes: Local agent', () => {
    const app = createApp();
    const clear = () => db.prepare('DELETE FROM ai_model').run();
    let dir;

    beforeEach(() => {
        clear();
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-agent-route-'));
    });
    afterEach(() => {
        delete process.env.FAKE_AGENT;
        fs.rmSync(dir, { recursive: true, force: true });
    });
    afterAll(clear);

    const get = async () => (await request(app).get('/api/ai-model')).body;
    const save = (body) =>
        request(app)
            .put('/api/ai-model')
            .send({ ...SETTINGS, ...body });
    const script = (steps) => {
        process.env.FAKE_AGENT = JSON.stringify({
            record: path.join(dir, 'record.json'),
            steps
        });
    };
    const test = async (body) =>
        (
            await request(app)
                .post('/api/ai-model/test')
                .send({ ...SETTINGS, ...body })
                .expect(200)
        ).body;

    it('offers Claude Code with its default arguments', async () => {
        const { agent, agents } = await get();

        expect(agent).toBe('claude');
        expect(agents).toEqual([
            expect.objectContaining({
                id: 'claude',
                name: 'Claude Code',
                command: 'claude',
                path: '',
                args: AGENTS[0].defaultArgs,
                defaultArgs: AGENTS[0].defaultArgs
            })
        ]);
    });

    it('saves the path and arguments, and shows the agent as found', async () => {
        const { body } = await save({ agentArgs: '-p --model haiku' }).expect(
            200
        );

        expect(body).toMatchObject({ mode: 'agent', ready: true });
        expect(body.agents[0]).toMatchObject({
            path: FAKE,
            args: '-p --model haiku',
            found: FAKE
        });
    });

    it('shows a missing CLI, which is not ready', async () => {
        const gone = path.join(dir, 'claude');
        const { body } = await save({ agentPath: gone }).expect(200);

        expect(body).toMatchObject({ mode: 'agent', ready: false });
        expect(body.agents[0].found).toBeNull();
    });

    it('stores the default arguments as such, to follow later defaults', async () => {
        await save({ agentArgs: AGENTS[0].defaultArgs }).expect(200);

        const row = db.prepare('SELECT agents FROM ai_model').get();
        expect(JSON.parse(row.agents).claude).toEqual({
            path: FAKE,
            args: ''
        });
    });

    it.each([
        ['an unknown agent', { agent: 'bash' }],
        ['a path to another program', { agentPath: '/bin/sh' }],
        ['a relative path', { agentPath: 'bin/claude' }]
    ])('refuses %s', async (_, body) => {
        await save(body).expect(400);
    });

    it('keeps the other modes’ settings', async () => {
        await request(app)
            .put('/api/ai-model')
            .send({
                mode: 'api',
                provider: 'anthropic',
                model: 'claude-opus-5-5',
                apiKey: 'sk-ant-api03-fake-key-for-tests-9F2c'
            })
            .expect(200);
        const { body } = await save().expect(200);

        expect(body).toMatchObject({
            model: 'claude-opus-5-5',
            keyLast4: '9F2c'
        });
    });

    it('runs a chat turn on the saved agent', async () => {
        await save().expect(200);
        script([{ say: 'It is a hash.' }]);
        const res = await request(app)
            .post('/api/ai-chat')
            .send({
                chatId: 'chat-agent-route',
                connectionId: global.TEST_CONNECTION_ID,
                messages: [{ role: 'user', text: 'What is this?' }]
            })
            .expect(200);

        expect(res.text.trim().split('\n').map(JSON.parse)).toEqual([
            { type: 'text', text: 'It is a hash.' },
            { type: 'done' }
        ]);
    });

    describe('Test', () => {
        it('runs one turn and counts the tools the agent lists', async () => {
            script([
                { say: '- mcp__redis-deck__get_key\n- get_info\n' },
                // The Test runs no tool, whatever the agent asks for.
                {
                    call: {
                        name: 'get_info',
                        args: { connectionId: global.TEST_CONNECTION_ID }
                    }
                },
                { say: '- scan_keys\n' }
            ]);
            const body = await test();

            expect(body).toEqual({
                ok: true,
                title: expect.stringMatching(
                    /^Claude Code answered in \d+(\.\d)? s$/
                ),
                detail: 'It listed 3 Redis Deck MCP tools.'
            });
            const record = JSON.parse(
                fs.readFileSync(path.join(dir, 'record.json'), 'utf8')
            );
            expect(record.stdin).toContain('redis-deck tools');
            expect(record.results).toEqual([
                { isError: true, text: expect.any(String) }
            ]);
            expect(await get()).toMatchObject({ mode: 'api' });
        });

        it('fails when the answer names no tool', async () => {
            script([{ say: 'I have no tools.' }]);

            expect(await test()).toEqual({
                ok: false,
                title: 'Claude Code listed no tools',
                detail: 'I have no tools.'
            });
        });

        it('reports a failing agent with what it printed', async () => {
            script([{ say: 'Invalid API key' }, { fail: 1 }]);

            expect(await test()).toEqual({
                ok: false,
                title: 'Claude Code did not answer',
                detail: 'Claude Code exited with code 1. Invalid API key'
            });
        });

        it('says the CLI is missing', async () => {
            expect(await test({ agentPath: path.join(dir, 'claude') })).toEqual(
                {
                    ok: false,
                    title: 'claude not found',
                    detail: expect.stringContaining('set its path')
                }
            );
        });
    });
});
