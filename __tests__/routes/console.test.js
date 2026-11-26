const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    createConnection,
    deleteConnection,
    getConnection
} = require('../../services/database');
const { execArgv } = require('../../services/redis');
const { dropClient } = require('../../services/redisClient');
const {
    createTestKey,
    createTestHash,
    createTestZSet,
    deleteTestKeys,
    keyExists
} = require('../helpers/testHelpers');
const {
    addGuardedConnection,
    removeConnections
} = require('../helpers/guardedConnections');

// Standalone only (the helpers here do not follow redirects); clustered
// Connections are covered by __tests__/cluster/console.cluster.test.js.
const standalone =
    process.env.REDIS_TEST_CLUSTER === 'true' ? describe.skip : describe;

standalone('Console routes', () => {
    const app = createApp();
    const PREFIX = 'test:console01';

    afterEach(() => deleteTestKeys(`${PREFIX}:*`));

    const run = (texts, env = global.TEST_CONNECTION_ID) =>
        request(app)
            .post(`/api/console/run?env=${env}`)
            .send({ statements: texts.map((text, line) => ({ line, text })) });

    const results = async (...texts) =>
        (await run(texts).expect(200)).body.results;

    test('runs a read and returns the reply, its kind and the duration', async () => {
        await createTestKey(`${PREFIX}:greeting`, 'hello');

        const [result] = await results(`GET ${PREFIX}:greeting`);

        expect(result).toMatchObject({
            line: 0,
            text: `GET ${PREFIX}:greeting`,
            kind: 'bulk',
            reply: 'hello'
        });
        expect(result.ms).toEqual(expect.any(Number));
    });

    test('serves the allowed list: reads and writes, with a warning on KEYS', async () => {
        const { body } = await request(app)
            .get('/api/console/commands')
            .expect(200);

        const reads = (
            'PING,ECHO,DBSIZE,SCAN,KEYS,TYPE,TTL,PTTL,EXISTS,GET,STRLEN,' +
            'HGETALL,HGET,HKEYS,HLEN,LLEN,LRANGE,ZRANGE,ZCARD,MEMORY USAGE,' +
            'OBJECT ENCODING,OBJECT IDLETIME,OBJECT FREQ,INFO,SLOWLOG GET,' +
            'CLIENT LIST,CONFIG GET,RANDOMKEY'
        ).split(',');
        const writes =
            'SET,HSET,HDEL,LPUSH,RPUSH,DEL,UNLINK,EXPIRE,PERSIST,RENAME,INCR'.split(
                ','
            );
        const listed = (access) =>
            Object.keys(body.commands)
                .filter((name) => body.commands[name].access === access)
                .sort();
        expect(listed('read')).toEqual(reads.sort());
        expect(listed('write')).toEqual(writes.sort());
        expect(Object.keys(body.commands)).toHaveLength(
            reads.length + writes.length
        );
        expect(body.commands.KEYS.warning).toMatch(/Prefer SCAN/);
    });

    // These run against a real, shared Redis. Every dangerous command below is
    // written so that Redis itself would reject it (bad option, unknown name or
    // missing argument): if the allowed list ever lets one through, the test
    // fails and the server is unharmed. Keep it that way.
    test.each([
        ['FLUSHDB not-an-option', 'FLUSHDB'],
        ['flushall not-an-option', 'FLUSHALL'],
        ['CONFIG SET test-console01-no-such-setting 0', 'CONFIG SET'],
        ['SHUTDOWN not-an-option', 'SHUTDOWN'],
        ['DEBUG test-console01-no-such-subcommand', 'DEBUG'],
        ['MONITOR not-an-argument', 'MONITOR'],
        ['SUBSCRIBE', 'SUBSCRIBE'],
        ['PSUBSCRIBE', 'PSUBSCRIBE']
    ])('refuses %s as turned off', async (text, name) => {
        const [result] = await results(text);

        expect(result).toMatchObject({
            kind: 'error',
            reply: `${name} is disabled in the console`
        });
    });

    test.each([
        ['CONFIG', 'CONFIG'],
        ['MEMORY HELP', 'MEMORY HELP'],
        ['SLOWLOG HELP', 'SLOWLOG HELP'],
        ['CLIENT HELP', 'CLIENT HELP'],
        ['OBJECT HELP', 'OBJECT HELP'],
        ['constructor', 'CONSTRUCTOR']
    ])('refuses %s', async (text, name) => {
        const [result] = await results(text);

        expect(result).toMatchObject({
            kind: 'error',
            reply: `${name} is not supported in this console`
        });
    });

    test('serves the refusal messages for the line check', async () => {
        const { body } = await request(app)
            .get('/api/console/commands')
            .expect(200);

        expect(body.unsupported).toBe(
            '{command} is not supported in this console'
        );
        expect(Object.keys(body.turnedOff).sort()).toEqual([
            'CONFIG SET',
            'DEBUG',
            'FLUSHALL',
            'FLUSHDB',
            'MONITOR',
            'PSUBSCRIBE',
            'SHUTDOWN',
            'SUBSCRIBE'
        ]);
        expect(body.turnedOff.FLUSHDB).toBe(
            'FLUSHDB is disabled in the console'
        );
    });

    test('runs the listed writes', async () => {
        const key = `${PREFIX}:w`;

        const list = await results(
            `SET ${key}:s 1`,
            `INCR ${key}:s`,
            `EXPIRE ${key}:s 100`,
            `PERSIST ${key}:s`,
            `RENAME ${key}:s ${key}:renamed`,
            `HSET ${key}:h a 1 b 2`,
            `HDEL ${key}:h a`,
            `LPUSH ${key}:l x`,
            `RPUSH ${key}:l y`,
            `LRANGE ${key}:l 0 -1`,
            `DEL ${key}:renamed`,
            `UNLINK ${key}:h ${key}:l`
        );

        expect(list.map((r) => r.reply)).toEqual([
            'OK',
            2,
            1,
            1,
            'OK',
            2,
            1,
            1,
            2,
            ['x', 'y'],
            1,
            2
        ]);
        expect(await keyExists(`${key}:renamed`)).toBe(false);
    });

    test('keeps the writes that ran before a later error', async () => {
        const key = `${PREFIX}:applied`;

        const list = await results(
            `SET ${key} v`,
            `INCR ${key}`,
            `SET ${key} later`
        );

        expect(list.map((r) => r.kind)).toEqual(['status', 'error', 'not-run']);
        const [after] = await results(`GET ${key}`);
        expect(after.reply).toBe('v');
    });

    test('runs listed subcommands and lower-case commands', async () => {
        const key = `${PREFIX}:sub`;
        await createTestKey(key, 'abc');

        const [usage, encoding, lower] = await results(
            `memory usage ${key}`,
            `OBJECT ENCODING ${key}`,
            `strlen ${key}`
        );

        expect(usage.kind).toBe('integer');
        expect(encoding).toMatchObject({ kind: 'bulk', reply: 'embstr' });
        expect(lower).toMatchObject({ kind: 'integer', reply: 3 });
    });

    test('keeps quoted arguments together', async () => {
        const key = `${PREFIX}:with space`;
        await createTestHash(key, { 'a field': 'v' });

        const [double, single, escaped] = await results(
            `HGET "${key}" "a field"`,
            `HGET '${key}' 'a field'`,
            'ECHO "say \\"hi\\""'
        );

        expect(double.reply).toBe('v');
        expect(single.reply).toBe('v');
        expect(escaped.reply).toBe('say "hi"');
    });

    test('tells status, nil, array and integer replies apart', async () => {
        const key = `${PREFIX}:kinds`;
        await createTestHash(key, { f: 'v' });

        const [ping, type, nil, array, integer, echo] = await results(
            'PING',
            `TYPE ${key}`,
            `GET ${PREFIX}:missing`,
            `HKEYS ${key}`,
            `HLEN ${key}`,
            'ECHO PONG'
        );

        expect(ping).toMatchObject({ kind: 'status', reply: 'PONG' });
        expect(type).toMatchObject({ kind: 'status', reply: 'hash' });
        expect(nil).toMatchObject({ kind: 'nil', reply: null });
        expect(array).toMatchObject({ kind: 'array', reply: ['f'] });
        expect(integer).toMatchObject({ kind: 'integer', reply: 1 });
        expect(echo).toMatchObject({ kind: 'bulk', reply: 'PONG' });
    });

    test('returns pairs as the plain reply, not as an object', async () => {
        const hash = `${PREFIX}:pairs-hash`;
        const zset = `${PREFIX}:pairs-zset`;
        // a field name that an object would swallow
        await createTestHash(hash, { name: 'Ada', __proto__x: '1' });
        await execArgv(
            ['HSET', hash, '__proto__', 'kept'],
            global.TEST_CONNECTION_ID
        );
        await createTestZSet(zset, [
            { score: 1.5, value: 'a' },
            { score: 'inf', value: 'b' }
        ]);

        const [all, scores, config, missing] = await results(
            `HGETALL ${hash}`,
            `ZRANGE ${zset} 0 -1 WITHSCORES`,
            'CONFIG GET maxmemory',
            `HGETALL ${PREFIX}:missing`
        );

        expect(all).toMatchObject({
            kind: 'array',
            reply: ['name', 'Ada', '__proto__x', '1', '__proto__', 'kept']
        });
        expect(scores).toMatchObject({
            kind: 'array',
            reply: [
                ['a', '1.5'],
                ['b', 'inf']
            ]
        });
        expect(config).toMatchObject({
            kind: 'array',
            reply: ['maxmemory', expect.any(String)]
        });
        expect(missing).toMatchObject({ kind: 'array', reply: [] });
    });

    test('returns SCAN as the cursor and the Key list', async () => {
        const key = `${PREFIX}:scan-me`;
        await createTestKey(key, 'v');

        const [scan] = await results(`SCAN 0 MATCH ${key} COUNT 100000`);

        expect(scan).toMatchObject({ kind: 'array', reply: ['0', [key]] });
    });

    test('returns the Redis error text', async () => {
        const key = `${PREFIX}:string`;
        await createTestKey(key, 'v');

        const [result] = await results(`HGETALL ${key}`);

        expect(result).toMatchObject({
            kind: 'error',
            reply: 'WRONGTYPE Operation against a key holding the wrong kind of value'
        });
    });

    test('stops at the first error; later statements are Not run', async () => {
        const key = `${PREFIX}:stop`;
        await createTestKey(key, 'v');

        const list = await results(
            `GET ${key}`,
            `HGETALL ${key}`,
            'PING',
            'NOPE'
        );

        expect(list.map((r) => [r.line, r.text, r.kind])).toEqual([
            [0, `GET ${key}`, 'bulk'],
            [1, `HGETALL ${key}`, 'error'],
            [2, 'PING', 'not-run'],
            [3, 'NOPE', 'not-run']
        ]);
        expect(list[2]).toMatchObject({ reply: null, ms: 0 });
    });

    test('a refused command also stops the run', async () => {
        const list = await results('NOPE', 'PING');

        expect(list.map((r) => r.kind)).toEqual(['error', 'not-run']);
    });

    test('does not log Console commands, also when they fail', async () => {
        const secret = `${PREFIX}:never-logged`;
        await createTestKey(secret, 'v');
        const spies = ['log', 'info', 'warn', 'error', 'debug'].map((method) =>
            jest.spyOn(console, method)
        );

        await results(`GET ${secret}`, `HGETALL ${secret}`, `NOPE ${secret}`);

        const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
        spies.forEach((spy) => spy.mockRestore());
        expect(output).not.toContain('never-logged');
    });

    describe('on other Connections', () => {
        const made = [];
        const connection = (id, extra) => {
            const { host, port } = getConnection(global.TEST_CONNECTION_ID);
            createConnection({ id, host, port, ...extra });
            made.push(id);
            return id;
        };

        afterAll(() => made.forEach(deleteConnection));

        test('scrubs Connection config from error text', async () => {
            const user = 'test-console01-user';
            const id = `test-console01-acl-${Date.now()}`;
            await execArgv(
                // may connect and PING, nothing else
                ['ACL', 'SETUSER', user, 'on', '>pw', '+@connection'],
                global.TEST_CONNECTION_ID
            );
            try {
                connection(id, { username: user, password: 'pw' });

                const { body } = await run(['GET any'], id).expect(200);

                expect(body.results[0].reply).toMatch(
                    /^NOPERM .*\*\*\*.*'get' command/
                );
                expect(body.results[0].reply).not.toContain(user);
            } finally {
                // before DELUSER, or the cached client keeps trying to log in
                await dropClient(id);
                await execArgv(
                    ['ACL', 'DELUSER', user],
                    global.TEST_CONNECTION_ID
                );
            }
        });

        test('reports an unreachable server, scrubbed, instead of hanging', async () => {
            const id = connection(`test-console01-down-${Date.now()}`, {
                host: '127.0.0.1',
                port: 1
            });

            const { body } = await run(['PING'], id).expect(200);

            expect(body.results[0]).toMatchObject({
                kind: 'error',
                reply: 'connect ECONNREFUSED ***:***'
            });
        });
    });

    describe('writes and the write guard', () => {
        const RO = 'test-console03-ro';
        const CW = 'test-console03-cw';
        const key = `${PREFIX}:guarded`;
        // a read first: it must not run either
        const BATCH = [`GET ${key}`, `SET ${key} new`, `del ${key}:other`];
        const WRITES = [
            { line: 1, text: BATCH[1] },
            { line: 2, text: BATCH[2] }
        ];

        beforeAll(() => {
            addGuardedConnection(RO, { readOnly: true });
            addGuardedConnection(CW, { confirmWrites: true });
        });
        afterAll(() => removeConnections(RO, CW));
        beforeEach(() => createTestKey(key, 'old'));

        const value = async () => (await results(`GET ${key}`))[0].reply;

        test.each([
            [403, RO, /read-only/],
            [428, CW, /need confirmation/]
        ])('answers %i and runs nothing on %s', async (status, env, error) => {
            const { body } = await run(BATCH, env).expect(status);

            expect(body).toEqual({
                error: expect.stringMatching(error),
                code: status,
                writes: WRITES
            });
            expect(await value()).toBe('old');
        });

        test('runs the whole batch on a confirmed retry', async () => {
            const { body } = await run(BATCH, CW)
                .set('X-Confirm-Connection', CW)
                .expect(200);

            expect(body.results.map((r) => r.reply)).toEqual(['old', 'OK', 0]);
            expect(await value()).toBe('new');
        });

        test('a confirmation does not open a Read-only Connection', async () => {
            await run(BATCH, RO).set('X-Confirm-Connection', RO).expect(403);

            expect(await value()).toBe('old');
        });

        test.each([RO, CW])(
            'needs no confirmation for a read-only batch on %s',
            async (env) => {
                const { body } = await run([`GET ${key}`, 'PING'], env).expect(
                    200
                );

                expect(body.results.map((r) => r.reply)).toEqual([
                    'old',
                    'PONG'
                ]);
            }
        );
    });

    test('answers 404 for an unknown Connection', async () => {
        await run(['PING'], 'test-console01-nope').expect(404);
    });

    test.each([
        ['no statements', {}],
        ['an empty list', { statements: [] }],
        ['a statement without text', { statements: [{ line: 0 }] }],
        ['a blank statement', { statements: [{ line: 0, text: '  ' }] }],
        ['a statement without a line', { statements: [{ text: 'PING' }] }]
    ])('answers 400 for %s', async (_, body) => {
        await request(app)
            .post(`/api/console/run?env=${global.TEST_CONNECTION_ID}`)
            .send(body)
            .expect(400);
    });
});
