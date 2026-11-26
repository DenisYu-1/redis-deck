/** @jest-environment node */
const { runTurn } = require('../../services/ai/turnRunner');
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
    keyExists,
    deleteTestKeys
} = require('../helpers/testHelpers');

const CONN = global.TEST_CONNECTION_ID;
const KEY = 'sk-ant-test-turn-runner-key';
const GUARDED = 'test-ai-guarded';

// Runs one turn against a scripted model -> every event, in order.
async function turn(script, request = {}) {
    const { adapter, seen } = fakeModel(script);
    const events = [];
    await runTurn({
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

        it.each([
            ['Ask before writes is on', CONN, {}],
            ['Ask before writes is off', CONN, { ask: false }],
            ['the Connection is production', GUARDED, {}]
        ])('refuses writes when %s', async (_, connectionId, access) => {
            setAiAccess(connectionId, { write: true, ...access });
            const { events, seen } = await turn(
                [
                    {
                        toolCalls: [
                            {
                                name: 'set_key',
                                args: {
                                    connectionId,
                                    key: 'test:ai:new',
                                    value: 'x'
                                }
                            }
                        ]
                    },
                    {}
                ],
                { connectionId }
            );

            expect(finished(events)).toMatchObject([{ status: 'denied' }]);
            expect(seen.results[0][0]).toMatchObject({ isError: true });
            expect(await keyExists('test:ai:new', CONN)).toBe(false);
            expect(logged()).toMatchObject([
                { client: 'Redis Deck Assistant', result: 'denied' }
            ]);
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
