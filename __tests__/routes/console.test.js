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
    deleteTestKeys,
    keyExists
} = require('../helpers/testHelpers');

// Clustered Connections are not supported by the Console yet.
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

    test('serves the allowed list: read commands, with a warning on KEYS', async () => {
        const { body } = await request(app)
            .get('/api/console/commands')
            .expect(200);

        const listed = (
            'PING,ECHO,DBSIZE,SCAN,KEYS,TYPE,TTL,PTTL,EXISTS,GET,STRLEN,' +
            'HGETALL,HGET,HKEYS,HLEN,LLEN,LRANGE,ZRANGE,ZCARD,MEMORY USAGE,' +
            'OBJECT ENCODING,OBJECT IDLETIME,OBJECT FREQ,INFO,SLOWLOG GET,' +
            'CLIENT LIST,CONFIG GET,RANDOMKEY'
        ).split(',');
        expect(Object.keys(body.commands).sort()).toEqual(listed.sort());
        for (const command of Object.values(body.commands)) {
            expect(command.access).toBe('read');
        }
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
        ['PSUBSCRIBE', 'PSUBSCRIBE'],
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

    test.each([
        'SET',
        'HSET',
        'HDEL',
        'LPUSH',
        'RPUSH',
        'DEL',
        'UNLINK',
        'EXPIRE',
        'PERSIST',
        'RENAME',
        'INCR'
    ])('refuses the write %s', async (command) => {
        const key = `${PREFIX}:untouched`;
        await createTestKey(key, '1');

        const [result] = await results(`${command} ${key} 2`);

        expect(result).toMatchObject({
            kind: 'error',
            reply: `${command} is not supported in this console`
        });
        const [after] = await results(`GET ${key}`);
        expect(after.reply).toBe('1');
        expect(await keyExists(key)).toBe(true);
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

        test('refuses a clustered Connection', async () => {
            const id = connection(`test-console01-cluster-${Date.now()}`, {
                cluster: true
            });

            const { body } = await run(['PING'], id).expect(400);

            expect(body.error).toMatch(/clustered/i);
        });
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
