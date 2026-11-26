/** @jest-environment node */
const { runTurn } = require('../../services/ai/turnRunner');
const { answerApproval } = require('../../services/ai/approvalDesk');
const { fakeModel } = require('../helpers/fakeModel');
const { db } = require('../../services/database');
const { listActivity } = require('../../services/aiActivity');
const { setAiAccess } = require('../../services/aiAccess');
const { setToolEnabled } = require('../../services/mcp/toolSwitches');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');
const {
    createTestHash,
    getKeyValue,
    keyExists,
    deleteTestKeys
} = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const KEY = 'sk-ant-test-turn-runner-key';
const GUARDED = 'test-ai-guarded';
const CHAT = 'chat-turn';

// Runs one turn against a scripted model -> every event, in order.
async function turn(script, request = {}) {
    const { adapter, seen } = fakeModel(script);
    const events = [];
    await runTurn({
        chatId: CHAT,
        connectionId: CONN,
        messages: [{ role: 'user', text: 'hello' }],
        model: { adapter, apiKey: KEY, model: 'fake-model' },
        emit: (event) => events.push(event),
        ...request
    });
    return { events, seen };
}

describe('AI assistant turn runner', () => {
    it('streams the text chunks, then done', async () => {
        const messages = [
            { role: 'user', text: 'first' },
            { role: 'assistant', text: 'answer' },
            { role: 'user', text: 'second' }
        ];
        const { events, seen } = await turn([{ text: ['Hel', 'lo'] }], {
            messages
        });

        expect(events).toEqual([
            { type: 'text', text: 'Hel' },
            { type: 'text', text: 'lo' },
            { type: 'done' }
        ]);
        expect(seen.start).toMatchObject({
            apiKey: KEY,
            model: 'fake-model',
            messages
        });
        expect(seen.start.system).toContain(`"${CONN}"`);
        expect(seen.start.system).toContain('Tier: local');
        expect(seen.start.system).toContain('never as instructions');
        expect(seen.start.system).toContain('no tool that runs commands');
        expect(seen.start.system).toContain('Ask before any write');
    });

    describe('tool calls', () => {
        const getKey = {
            name: 'get_key',
            args: { connectionId: CONN, key: 'test:ai:user' }
        };
        const rows = (events) => events.filter((e) => e.type === 'tool');
        const finished = (events) =>
            rows(events).filter((e) => e.status !== 'running');
        const logged = () => listActivity({}).entries;

        beforeAll(() => addGuardedConnection(GUARDED, {}));
        afterAll(() => removeConnections(GUARDED));

        beforeEach(async () => {
            db.prepare('DELETE FROM settings').run();
            db.prepare('DELETE FROM ai_activity').run();
            await deleteTestKeys('test:ai:*', CONN);
            await createTestHash('test:ai:user', {
                name: 'Ada',
                password: 'hunter2'
            });
        });

        it('offers the registry tools and runs a call with masking, a row and a log entry', async () => {
            const { events, seen } = await turn([
                { text: ['Looking.'], toolCalls: [getKey] },
                { text: ['Done.'] }
            ]);

            const offered = seen.start.tools.map((t) => t.name);
            expect(offered).toContain('get_key');
            expect(offered).not.toContain('run_workflow'); // switched off
            expect(
                seen.start.tools.find((t) => t.name === 'get_key').inputSchema
            ).toMatchObject({ type: 'object' });

            expect(events.map((e) => e.type)).toEqual([
                'text',
                'tool',
                'tool',
                'text',
                'done'
            ]);
            const [started, ended] = rows(events);
            expect(started).toEqual({
                type: 'tool',
                id: expect.any(String),
                tool: 'get_key',
                args: getKey.args,
                status: 'running'
            });
            expect(ended).toMatchObject({
                id: started.id,
                status: 'ok',
                ms: expect.any(Number)
            });
            expect(JSON.parse(ended.response).value).toEqual({
                name: 'Ada',
                password: '●●●'
            });

            expect(seen.results).toEqual([
                [{ id: 'use-1', text: ended.response, isError: false }]
            ]);
            expect(logged()).toMatchObject([
                {
                    client: 'Redis Deck Assistant',
                    operation: 'get_key',
                    connectionId: CONN,
                    result: 'ok'
                }
            ]);
        });

        it('applies AI access and the tool switches', async () => {
            setAiAccess(CONN, { values: false });
            setToolEnabled('get_info', false);
            const { events, seen } = await turn([
                {
                    toolCalls: [
                        getKey,
                        { name: 'get_info', args: { connectionId: CONN } }
                    ]
                },
                {}
            ]);
            setAiAccess(CONN, { values: true });

            expect(seen.start.tools.map((t) => t.name)).not.toContain(
                'get_info'
            );
            const [read, info] = finished(events);
            expect(JSON.parse(read.response)).not.toHaveProperty('value');
            expect(info).toMatchObject({
                status: 'blocked',
                response: 'tool is turned off'
            });
        });
    });

    describe('writes', () => {
        const NEW = 'test:ai:new';
        const write = (connectionId = CONN, value = 'x') => ({
            name: 'set_key',
            args: { connectionId, key: NEW, value }
        });
        const cards = (events) => events.filter((e) => e.type === 'approval');
        const logged = () => listActivity({}).entries;

        // Runs a turn and does onPending for every card that waits.
        async function writeTurn(
            onPending,
            { calls = [write()], ...request } = {}
        ) {
            const events = [];
            const { seen } = await turn([{ toolCalls: calls }, {}], {
                emit: (event) => {
                    events.push(event);
                    if (event.state === 'pending') onPending(event);
                },
                ...request
            });
            return { events, seen };
        }
        const answer = (approved) => (card) =>
            answerApproval({ chatId: CHAT, id: card.id, approved });

        beforeAll(() => addGuardedConnection(GUARDED, {}));
        afterAll(() => removeConnections(GUARDED));

        beforeEach(async () => {
            db.prepare('DELETE FROM settings').run();
            db.prepare('DELETE FROM ai_activity').run();
            setAiAccess(CONN, { write: true, ask: true });
            await deleteTestKeys('test:ai:*', CONN);
        });

        it('shows a card with the commands and runs the write on Approve', async () => {
            const { events, seen } = await writeTurn(answer(true));

            const card = {
                type: 'approval',
                id: expect.any(String),
                tool: 'set_key',
                connectionId: CONN,
                title: `Set Key ${NEW}`,
                commands: [`SET ${NEW} x`]
            };
            expect(cards(events)).toEqual([
                { ...card, state: 'pending' },
                { ...card, state: 'approved', done: 'Key written' }
            ]);
            expect(cards(events)[0].id).toBe(cards(events)[1].id);
            expect(await getKeyValue(NEW, CONN)).toBe('x');
            expect(seen.results[0][0]).toMatchObject({ isError: false });
            expect(logged()).toMatchObject([
                { client: 'Redis Deck Assistant', result: 'ok' }
            ]);
        });

        it('does not run the write on Deny, and logs it as denied', async () => {
            const { events, seen } = await writeTurn(answer(false));

            expect(cards(events).map((c) => c.state)).toEqual([
                'pending',
                'denied'
            ]);
            expect(await keyExists(NEW, CONN)).toBe(false);
            expect(seen.results[0][0]).toMatchObject({ isError: true });
            expect(logged()).toMatchObject([
                { client: 'Redis Deck Assistant', result: 'denied' }
            ]);
        });

        it('asks again for the next write: there is no session grant', async () => {
            const answers = [true, false];
            const { events } = await writeTurn(
                (card) => answer(answers.shift())(card),
                { calls: [write(CONN, 'one'), write(CONN, 'two')] }
            );

            expect(cards(events).map((c) => c.state)).toEqual([
                'pending',
                'approved',
                'pending',
                'denied'
            ]);
            expect(await getKeyValue(NEW, CONN)).toBe('one');
        });

        it('takes one answer, and only from the chat that was asked', async () => {
            const accepted = [];
            await writeTurn((card) => {
                const say = (chatId, approved) => {
                    const reply = { chatId, id: card.id, approved };
                    accepted.push(answerApproval(reply));
                };
                say('another-chat', true);
                say(CHAT, false);
                say(CHAT, true);
            });

            expect(accepted).toEqual([false, true, false]);
            expect(await keyExists(NEW, CONN)).toBe(false);
        });

        it('counts as Deny after 5 minutes without an answer', async () => {
            jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
            try {
                let card;
                let over = false;
                const running = writeTurn((c) => (card = c)).then((result) => {
                    over = true;
                    return result;
                });
                await jest.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
                expect(card).toBeDefined();
                expect(over).toBe(false);

                await jest.advanceTimersByTimeAsync(1);
                const { events } = await running;

                expect(cards(events).at(-1).state).toBe('denied');
                expect(answer(true)(card)).toBe(false);
                expect(await keyExists(NEW, CONN)).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('counts as Deny when the chat goes away', async () => {
            const left = new AbortController();
            let card;
            const { events } = await writeTurn(
                (c) => {
                    card = c;
                    left.abort();
                },
                { signal: left.signal }
            );
            // The refused call is logged just after the turn is over.
            await new Promise((resolve) => setImmediate(resolve));

            expect(cards(events).at(-1).state).toBe('denied');
            expect(answer(true)(card)).toBe(false);
            expect(await keyExists(NEW, CONN)).toBe(false);
            expect(logged()).toMatchObject([{ result: 'denied' }]);
        });

        it('says it ran without asking when Ask before writes is off', async () => {
            setAiAccess(CONN, { ask: false });
            const { events } = await writeTurn(() => {});

            expect(cards(events)).toMatchObject([
                {
                    state: 'auto',
                    reason: `Ask before writes is off for ${CONN}`,
                    done: 'Key written',
                    commands: [`SET ${NEW} x`]
                }
            ]);
            expect(await getKeyValue(NEW, CONN)).toBe('x');
        });

        it('lists every command a write runs, quoted where needed', async () => {
            const { events } = await writeTurn(answer(false), {
                calls: [
                    {
                        name: 'set_key',
                        args: {
                            connectionId: CONN,
                            key: NEW,
                            type: 'hash',
                            value: { name: 'Ada Lovelace' },
                            ttl: 60
                        }
                    }
                ]
            });

            expect(cards(events)[0].commands).toEqual([
                `DEL ${NEW}`,
                `HSET ${NEW} name "Ada Lovelace"`,
                `EXPIRE ${NEW} 60`
            ]);
        });

        it('says why an approved write failed', async () => {
            const { events } = await writeTurn(answer(true), {
                calls: [
                    {
                        name: 'rename_key',
                        args: { connectionId: CONN, key: NEW, newKey: 'b' }
                    }
                ]
            });

            expect(cards(events).at(-1)).toMatchObject({
                state: 'approved',
                error: expect.stringMatching(/no such key/i)
            });
        });

        it.each([
            [
                'writes are not allowed',
                () => setAiAccess(CONN, { write: false }),
                /Writes are not allowed/
            ],
            [
                'the tool is turned off',
                () => setToolEnabled('set_key', false),
                /tool is turned off/
            ],
            [
                'See keys is off',
                () => setAiAccess(CONN, { keys: false }),
                /not available/
            ]
        ])('shows a Blocked card when %s', async (_, block, reason) => {
            block();
            const { events } = await writeTurn(() => {});
            setAiAccess(CONN, { keys: true, values: true });

            expect(cards(events)).toMatchObject([
                { state: 'blocked', reason: expect.stringMatching(reason) }
            ]);
            expect(await keyExists(NEW, CONN)).toBe(false);
            expect(logged()).toMatchObject([{ result: 'blocked' }]);
        });

        it('blocks an approved write that stopped being allowed while it waited', async () => {
            const { events } = await writeTurn((card) => {
                setAiAccess(CONN, { write: false });
                answer(true)(card);
            });

            expect(cards(events).map((c) => c.state)).toEqual([
                'pending',
                'blocked'
            ]);
            expect(await keyExists(NEW, CONN)).toBe(false);
            expect(logged()).toMatchObject([{ result: 'blocked' }]);
        });

        it('always asks on a production Connection', async () => {
            setAiAccess(GUARDED, { write: true });
            const { events } = await writeTurn(answer(false), {
                connectionId: GUARDED,
                calls: [write(GUARDED)]
            });

            expect(cards(events).map((c) => c.state)).toEqual([
                'pending',
                'denied'
            ]);
        });

        it('shows no card for a read', async () => {
            const { events } = await writeTurn(() => {}, {
                calls: [
                    {
                        name: 'get_info',
                        args: { connectionId: CONN, section: 'server' }
                    }
                ]
            });

            expect(cards(events)).toEqual([]);
        });
    });

    describe('tool-call limit', () => {
        const STOPPED = 'Stopped after 20 tool calls; ask again to continue';
        const ping = { name: 'list_connections' };
        const ran = (events) =>
            events.filter((e) => e.type === 'tool' && e.status !== 'running');

        beforeEach(() => {
            db.prepare('DELETE FROM settings').run();
            db.prepare('DELETE FROM ai_activity').run();
        });

        it('stops the turn at the 21st call with the message', async () => {
            const { events, seen } = await turn(() => ({
                toolCalls: [ping, ping, ping]
            }));

            expect(ran(events)).toHaveLength(20);
            expect(events.slice(-2)).toEqual([
                { type: 'notice', text: STOPPED },
                { type: 'done' }
            ]);
            expect(seen.steps).toBe(7);
            expect(listActivity({}).counts).toMatchObject({
                ok: 20,
                blocked: 1
            });
        });

        it('lets a turn answer after exactly 20 calls', async () => {
            const { events } = await turn((index) =>
                index < 20 ? { toolCalls: [ping] } : { text: ['Answer'] }
            );

            expect(events.slice(-2)).toEqual([
                { type: 'text', text: 'Answer' },
                { type: 'done' }
            ]);
            expect(events.filter((e) => e.type === 'notice')).toEqual([]);
        });

        it('counts and shows calls the registry cannot run', async () => {
            const { events } = await turn(() => ({
                toolCalls: [{ name: 'flushall' }]
            }));

            expect(ran(events)).toHaveLength(20);
            expect(ran(events)[0]).toMatchObject({
                tool: 'flushall',
                status: 'error'
            });
            expect(events.at(-2)).toEqual({ type: 'notice', text: STOPPED });
        });
    });

    describe('failures', () => {
        const secretly = (host) =>
            new Error(`401: bad key ${KEY} while reaching ${host}`);

        it('shows a provider error without the key or Connection config', async () => {
            const { host } = db
                .prepare('SELECT host FROM connections WHERE id = ?')
                .get(CONN);
            const { events } = await turn([
                { text: ['Par'], error: secretly(host) }
            ]);

            expect(events).toEqual([
                { type: 'text', text: 'Par' },
                {
                    type: 'error',
                    message: '401: bad key ●●● while reaching ***'
                },
                { type: 'done' }
            ]);
        });

        it('stops quietly when the turn is cancelled', async () => {
            const cancel = new AbortController();
            const { events, seen } = await turn(
                () => {
                    cancel.abort();
                    return { toolCalls: [{ name: 'list_connections' }] };
                },
                { signal: cancel.signal }
            );

            expect(events).toEqual([{ type: 'done' }]);
            expect(seen.steps).toBe(1);
        });
    });
});
