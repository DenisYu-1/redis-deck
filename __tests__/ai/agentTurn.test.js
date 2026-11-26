/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runTurn } = require('../../services/ai/turnRunner');
const { answerApproval } = require('../../services/ai/approvalDesk');
const { db } = require('../../services/database');
const { setAiAccess } = require('../../services/aiAccess');
const { listActivity } = require('../../services/aiActivity');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const {
    createTestHash,
    keyExists,
    deleteTestKeys
} = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const GUARDED = 'test-ai-guarded';
const CHAT = 'chat-agent';
const FAKE = path.join(__dirname, '../fixtures/agent/claude');
const getKey = {
    name: 'get_key',
    args: { connectionId: CONN, key: 'test:agent:user' }
};
const setKey = {
    name: 'set_key',
    args: { connectionId: GUARDED, key: 'test:agent:written', value: 'x' }
};

let dir;
let recordFile;

const record = () => JSON.parse(fs.readFileSync(recordFile, 'utf8'));
const alive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

// Runs one turn of the fake agent playing `steps` -> every event, in order.
// onEvent sees each event as it comes.
async function turn(steps, { onEvent = () => {}, model, ...request } = {}) {
    process.env.FAKE_AGENT = JSON.stringify({ record: recordFile, steps });
    const events = [];
    await runTurn({
        chatId: CHAT,
        connectionId: CONN,
        messages: [{ role: 'user', text: 'hello' }],
        model: { agent: 'claude', path: FAKE, args: '', ...model },
        emit: (event) => {
            events.push(event);
            onEvent(event);
        },
        ...request
    });
    return events;
}

const types = (events) => events.map((e) => e.type);
const textOf = (events) =>
    events
        .filter((e) => e.type === 'text')
        .map((e) => e.text)
        .join('');

// The endpoint is gone, and so is the temp config file with its folder.
async function expectCleanedUp() {
    const { cwd, server, pid } = record();
    const { url, headers } = server;
    expect(fs.existsSync(cwd)).toBe(false);
    expect(alive(pid)).toBe(false);
    await expect(fetch(url, { method: 'POST', headers })).rejects.toThrow();
}

beforeAll(() => addGuardedConnection(GUARDED, {}));
afterAll(() => removeConnections(GUARDED));

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-fake-agent-'));
    recordFile = path.join(dir, 'record.json');
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM ai_activity').run();
    setAiAccess(GUARDED, { write: true });
    await deleteTestKeys('test:agent:*', CONN);
    await createTestHash('test:agent:user', {
        name: 'Ada',
        password: 'hunter2'
    });
});
afterEach(() => {
    delete process.env.FAKE_AGENT;
    fs.rmSync(dir, { recursive: true, force: true });
});

it('streams stdout as text, with the transcript on stdin and our config only', async () => {
    const events = await turn([{ say: 'It is ' }, { say: 'a hash — ✓' }], {
        messages: [
            { role: 'user', text: 'first' },
            { role: 'assistant', text: 'answer' },
            { role: 'user', text: '/second' }
        ]
    });

    expect(textOf(events)).toBe('It is a hash — ✓');
    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(types(events)).not.toContain('error');

    const seen = record();
    expect(seen.stdin).toContain(
        'User: first\n\nAssistant: answer\n\nUser: /second'
    );
    const configPath = seen.argv[seen.argv.indexOf('--mcp-config') + 1];
    expect(path.dirname(path.dirname(configPath))).toBe(os.tmpdir());
    expect(seen.argv).toEqual([
        '-p',
        '--strict-mcp-config',
        '--mcp-config',
        configPath,
        '--allowedTools',
        'mcp__redis-deck__*',
        '--disallowedTools',
        'Bash,Edit,Write,Read,WebFetch',
        '--tools',
        '',
        '--setting-sources',
        '',
        '--disable-slash-commands',
        '--no-session-persistence',
        '--system-prompt',
        expect.stringContaining(`The current Connection is "${CONN}"`)
    ]);
    expect(seen.config.mode).toBe(0o600);
    expect(JSON.parse(seen.config.text).mcpServers['redis-deck']).toEqual({
        type: 'http',
        url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/),
        headers: { Authorization: expect.stringMatching(/^Bearer \S{32,}$/) },
        timeout: 600_000
    });
    // An @path in the prompt would otherwise attach that file; and a tool call
    // may wait 5 minutes for the approval.
    expect(seen.env.attachmentsOff).toBe('1');
    expect(Number(seen.env.idleTimeout)).toBeGreaterThan(5 * 60 * 1000);
    await expectCleanedUp();
});

it('takes the Arguments field in place of the default ones', async () => {
    await turn([], {
        model: { args: `--mcp-config {mcp_config} --model 'a b' ""` }
    });

    const { argv } = record();
    expect(argv.slice(2, 5)).toEqual(['--model', 'a b', '']);
});

it('gets rows and the registry, with masking and logging, from the endpoint', async () => {
    const events = await turn([{ call: getKey }, { say: 'Done.' }]);

    expect(record().tools).toContain('get_key');
    expect(record().tools).not.toContain('run_workflow');
    const rows = events.filter((e) => e.type === 'tool');
    expect(rows).toMatchObject([
        { tool: 'get_key', args: getKey.args, status: 'running' },
        { tool: 'get_key', status: 'ok', ms: expect.any(Number) }
    ]);
    expect(JSON.parse(record().results[0].text).value).toEqual({
        name: 'Ada',
        password: '●●●'
    });
    expect(listActivity({}).entries).toMatchObject([
        { client: 'Redis Deck Assistant', operation: 'get_key', result: 'ok' }
    ]);
});

it.each([
    [true, 'approved', true],
    [false, 'denied', false]
])(
    'shows an approval card and goes on with the answer (approved: %s)',
    async (approved, state, written) => {
        const events = await turn([{ call: setKey }, { say: 'Done.' }], {
            connectionId: GUARDED,
            onEvent: (event) => {
                if (event.state === 'pending') {
                    answerApproval({ chatId: CHAT, id: event.id, approved });
                }
            }
        });

        const cards = events.filter((e) => e.type === 'approval');
        expect(cards.map((c) => c.state)).toEqual(['pending', state]);
        expect(await keyExists('test:agent:written', CONN)).toBe(written);
        expect(textOf(events)).toBe('Done.');
    }
);

it.each(['', 'wrong', 'Bearer wrong'])(
    'refuses the authorization %p on the endpoint, which only listens on 127.0.0.1',
    async (authorization) => {
        const stop = new AbortController();
        let checks;
        const check = async () => {
            while (!record().tools) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            const { url } = record().server;
            const refused = await fetch(url, {
                method: 'POST',
                headers: { authorization },
                body: '{}'
            });
            expect(refused.status).toBe(401);
            const other = url.replace('127.0.0.1', '[::1]');
            await expect(fetch(other, { method: 'POST' })).rejects.toThrow();
            stop.abort();
        };
        await turn([{ say: 'x' }, { hang: true }], {
            signal: stop.signal,
            onEvent: (event) => {
                if (event.type === 'text') checks = check();
            }
        });
        await checks;
    }
);

it('refuses the token of an earlier turn', async () => {
    await turn([]);
    const old = record().server.headers;
    const stop = new AbortController();
    let status;
    await turn([{ say: 'x' }, { hang: true }], {
        signal: stop.signal,
        onEvent: async (event) => {
            if (event.type !== 'text') return;
            const { url } = record().server;
            ({ status } = await fetch(url, { method: 'POST', headers: old }));
            stop.abort();
        }
    });
    expect(status).toBe(401);
});

it('stops the turn after 20 tool calls, and refuses the next', async () => {
    const events = await turn([
        ...Array(20).fill({ call: getKey }),
        { call: setKey },
        { hang: true }
    ]);

    expect(events.slice(-2)).toEqual([
        {
            type: 'notice',
            text: 'Stopped after 20 tool calls; ask again to continue'
        },
        { type: 'done' }
    ]);
    expect(events.filter((e) => e.status === 'ok')).toHaveLength(20);
    expect(await keyExists('test:agent:written', CONN)).toBe(false);
    expect(listActivity({}).entries[0]).toMatchObject({
        operation: 'set_key',
        result: 'blocked'
    });
    await expectCleanedUp();
});

it('kills the agent and denies the waiting write when the chat leaves', async () => {
    const leave = new AbortController();
    const events = await turn([{ call: setKey }, { hang: true }], {
        connectionId: GUARDED,
        signal: leave.signal,
        onEvent: (event) => {
            if (event.state === 'pending') leave.abort();
        }
    });

    expect(types(events)).not.toContain('error');
    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(await keyExists('test:agent:written', CONN)).toBe(false);
    await expectCleanedUp();
});

it('denies the waiting write before done when the agent dies', async () => {
    let pid;
    const events = await turn([{ call: setKey }], {
        connectionId: GUARDED,
        onEvent: (event) => {
            if (event.state !== 'pending') return;
            ({ pid } = record());
            process.kill(pid, 'SIGKILL');
        }
    });

    expect(events.slice(-4).map((e) => e.state ?? e.status ?? e.type)).toEqual([
        'denied',
        'denied',
        'error',
        'done'
    ]);
    expect(events.at(-2).message).toBe('Claude Code was stopped (SIGKILL).');
    expect(await keyExists('test:agent:written', CONN)).toBe(false);
    await expectCleanedUp();
});

it('reports what a failing agent says', async () => {
    const events = await turn([{ fail: 1, stderr: 'Please run /login\n' }]);

    expect(events).toEqual([
        {
            type: 'error',
            message: 'Claude Code exited with code 1: Please run /login'
        },
        { type: 'done' }
    ]);
    await expectCleanedUp();
});

it('says when the agent printed nothing', async () => {
    const events = await turn([]);

    expect(events).toEqual([
        { type: 'error', message: 'Claude Code printed no answer.' },
        { type: 'done' }
    ]);
});

it('says when the CLI is missing', async () => {
    const events = await turn([], {
        model: { path: path.join(dir, 'claude') }
    });

    expect(events).toEqual([
        {
            type: 'error',
            message: expect.stringMatching(
                /^Claude Code \(claude\) was not found/
            )
        },
        { type: 'done' }
    ]);
});
