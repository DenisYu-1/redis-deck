/** @jest-environment node */
// What Codex CLI and Gemini CLI are started with, and that rows, approval cards
// and the limit work on them as on Claude Code (see agentTurn.test.js).
const fs = require('fs');
const path = require('path');
const { createFakeAgent } = require('../helpers/fakeAgent');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');
const { answerApproval } = require('../../services/ai/approvalDesk');
const { setAiAccess } = require('../../services/aiAccess');
const { listActivity } = require('../../services/aiActivity');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const { deleteTestKeys } = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const GUARDED = 'test-ai-clis';
const ZERO_WIDTH = String.fromCharCode(0x200b);
const setKey = (connectionId, key, value) => ({
    call: { name: 'set_key', args: { connectionId, key, value } }
});

let fake;

beforeAll(() => addGuardedConnection(GUARDED, {}));
afterAll(() => removeConnections(GUARDED));

beforeEach(async () => {
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM ai_activity').run();
    setAiAccess(GUARDED, { write: true });
    await deleteTestKeys('test:agent:*', CONN);
    fake = createFakeAgent();
});
afterEach(() => fake.remove());

describe('Codex CLI', () => {
    it('is started with our MCP server only, the token kept out of argv', async () => {
        const events = await fake.turn('codex', [{ say: 'Hi.' }]);

        expect(events).toEqual([
            { type: 'text', text: 'Hi.' },
            { type: 'done' }
        ]);
        const { argv, overrides, server, stdin, cwd } = fake.record();
        expect(argv[0]).toBe('exec');
        expect(argv.join(' ')).toContain(
            'exec --sandbox read-only --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check'
        );
        // No built-in tool that reads the disk, runs commands or goes online.
        const disabled = argv.filter((_, i) => argv[i - 1] === '--disable');
        expect(disabled).toEqual(
            expect.arrayContaining([
                'shell_tool',
                'unified_exec',
                'view_image',
                'multi_agent',
                'apps',
                'plugins',
                'hooks'
            ])
        );
        expect(overrides).toMatchObject({
            web_search: 'disabled',
            'agents.enabled': 'false',
            'mcp_servers.redis-deck.default_tools_approval_mode': '"approve"',
            'mcp_servers.redis-deck.required': 'true',
            // A call may wait 5 minutes for the approval; Codex waits 60 s.
            'mcp_servers.redis-deck.tool_timeout_sec': '600'
        });
        expect(JSON.parse(overrides.developer_instructions)).toContain(
            `The current Connection is "${CONN}"`
        );
        expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
        const token = server.headers.Authorization.replace('Bearer ', '');
        expect(token.length).toBeGreaterThanOrEqual(32);
        expect(argv.join(' ')).not.toContain(token);
        expect(stdin).toContain('User: hello');
        // A fresh folder, gone with the turn: no project files reach the agent.
        expect(path.basename(cwd)).toMatch(/^redis-deck-agent-/);
        expect(fs.existsSync(cwd)).toBe(false);
    });

    // Codex attaches the SKILL.md of every $name in the prompt.
    it('breaks $name mentions in the prompt, and mends them on the way back', async () => {
        const events = await fake.turn(
            'codex',
            [
                setKey(
                    CONN,
                    'test:agent:dollar',
                    `$${ZERO_WIDTH}HOME costs $ 5`
                ),
                { say: `It is $${ZERO_WIDTH}HOME.` }
            ],
            { messages: [{ role: 'user', text: 'Save $HOME, [$a:b](x)' }] }
        );

        expect(fake.record().stdin).toContain(
            `Save $${ZERO_WIDTH}HOME, [$${ZERO_WIDTH}a:b](x)`
        );
        expect(await execRedisCommand('GET test:agent:dollar', CONN)).toBe(
            '$HOME costs $ 5'
        );
        expect(events.find((e) => e.type === 'tool').args.value).toBe(
            '$HOME costs $ 5'
        );
        expect(events.find((e) => e.type === 'text').text).toBe('It is $HOME.');
    });

    // Its stderr repeats the whole prompt before the error.
    it('reports the error line of a failed run, not the prompt', async () => {
        const stderr = [
            'user',
            'what is in session:42?',
            'ERROR: Reconnecting... 5/5',
            'ERROR: unexpected status 401 Unauthorized',
            ''
        ].join('\n');
        const events = await fake.turn('codex', [{ fail: 1, stderr }]);

        expect(events[0]).toEqual({
            type: 'error',
            message:
                'Codex CLI exited with code 1: ERROR: unexpected status 401 Unauthorized'
        });
    });
});

describe('Gemini CLI', () => {
    it('is started with our MCP server, and a policy denying every other tool', async () => {
        const events = await fake.turn('gemini', [{ say: 'Hi.' }]);

        expect(events).toEqual([
            { type: 'text', text: 'Hi.' },
            { type: 'done' }
        ]);
        const seen = fake.record();
        expect(seen.argv).toEqual([
            '-p',
            'Answer as asked above.',
            '-o',
            'text',
            '--allowed-mcp-server-names',
            'redis-deck',
            '-e',
            'none',
            '--admin-policy',
            seen.policyPath
        ]);
        expect(path.basename(seen.policyPath)).toBe('policy.toml');
        expect(seen.policy.text).toBe(
            [
                '[[rule]]',
                'toolName = "*"',
                'decision = "deny"',
                'priority = 100',
                '',
                '[[rule]]',
                'mcpName = "redis-deck"',
                'toolName = "*"',
                'decision = "allow"',
                'priority = 200',
                ''
            ].join('\n')
        );
        expect(JSON.parse(seen.settings.text)).toEqual({
            mcpServers: {
                'redis-deck': {
                    httpUrl: seen.server.url,
                    headers: seen.server.headers,
                    timeout: 600_000,
                    trust: true
                }
            },
            mcp: { allowed: ['redis-deck'] },
            // Nothing of the user's: instructions, hooks, skills.
            context: { fileName: 'REDIS_DECK_NO_CONTEXT.md' },
            hooksConfig: { enabled: false },
            skills: { enabled: false }
        });
        expect([seen.settings.mode, seen.policy.mode]).toEqual([0o600, 0o600]);
        // An untrusted folder would load no MCP server.
        expect(seen.env.trust).toBe('true');
        // The system prompt has no flag of its own.
        expect(seen.stdin).toMatch(
            /^You are the AI assistant[\s\S]*User: hello$/
        );
        expect(fs.existsSync(seen.cwd)).toBe(false);
    });

    // Gemini reads the file of every @path in the prompt, Redis data included.
    it('escapes every @ in the prompt, and unescapes what comes back', async () => {
        const events = await fake.turn(
            'gemini',
            [
                setKey(CONN, 'test:agent:mail', 'ada\\@example.com'),
                { say: 'Saved ada\\@example.com' }
            ],
            {
                messages: [
                    { role: 'user', text: 'Read @/etc/passwd, \\@kept, a@@b' }
                ]
            }
        );

        const { stdin } = fake.record();
        expect(stdin).toContain('Read \\@/etc/passwd, \\@kept, a\\@\\@b');
        expect(stdin.match(/(?<!\\)@/g)).toBeNull();
        expect(await execRedisCommand('GET test:agent:mail', CONN)).toBe(
            'ada@example.com'
        );
        expect(events.find((e) => e.type === 'text').text).toBe(
            'Saved ada@example.com'
        );
    });
});

it.each(['codex', 'gemini'])(
    'gets rows, approval cards and the 20-call limit on %s',
    async (agent) => {
        const read = {
            call: {
                name: 'get_key',
                args: { connectionId: CONN, key: 'test:agent:none' }
            }
        };
        const write = setKey(GUARDED, 'test:agent:written', 'x');
        const events = await fake.turn(
            agent,
            [write, ...Array(19).fill(read), write, { hang: true }],
            {
                connectionId: GUARDED,
                onEvent: (event) => {
                    if (event.state !== 'pending') return;
                    answerApproval({
                        chatId: 'chat-agent',
                        id: event.id,
                        approved: true
                    });
                }
            }
        );

        expect(
            events.filter((e) => e.type === 'approval').map((e) => e.state)
        ).toEqual(['pending', 'approved']);
        expect(events.filter((e) => e.status === 'running')).toHaveLength(20);
        expect(events.at(-2)).toEqual({
            type: 'notice',
            text: 'Stopped after 20 tool calls; ask again to continue'
        });
        expect(listActivity({}).entries[0]).toMatchObject({
            client: 'Redis Deck Assistant',
            operation: 'set_key',
            result: 'blocked'
        });
    }
);
