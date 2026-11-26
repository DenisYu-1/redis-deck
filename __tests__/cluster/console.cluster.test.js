// The Console on a clustered Connection: `redis-cli -c` per statement (ADR 0002).
// Keyed commands follow redirects, so the Nodes' announced addresses must be
// reachable from here.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const request = require('supertest');
const { createApp } = require('../../config/app');
const {
    createConnection,
    deleteConnection
} = require('../../services/database');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const {
    enabled,
    SEED,
    cli,
    clusterNodes,
    nodeRemap
} = require('../helpers/clusterTarget');

const CONN = 'test-cluster-console';
const PREFIX = 'test:console07';
const [HOST, PORT] = SEED.split(':');

(enabled ? describe : describe.skip)('cluster: Console', () => {
    const app = createApp();
    let spawns;
    let masters;

    const run = (texts, env = CONN) =>
        request(app)
            .post(`/api/console/run?env=${env}`)
            .send({ statements: texts.map((text, line) => ({ line, text })) });
    const results = async (...texts) =>
        (await run(texts).expect(200)).body.results;
    const shapes = (list) => list.map(({ kind, reply }) => [kind, reply]);

    // enough Keys to land on every master
    const KEYS = Array.from({ length: 12 }, (_, i) => `${PREFIX}:k${i}`);

    beforeAll(() => {
        masters = clusterNodes().map((n) => n.announced);
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
        createConnection({
            id: CONN,
            host: HOST,
            port: Number(PORT),
            cluster: true
        });
    });
    afterEach(async () => {
        // one DEL each: Keys in one command must share a slot
        const names = [...KEYS, ...['s', 'h', 'z', 'l'].map(tagged)];
        await results(...names.map((key) => `DEL "${key}"`));
    });
    afterAll(() => {
        spawns.restore();
        deleteConnection(CONN);
    });

    const tagged = (name) => `${PREFIX}:{t}:${name}`;

    test('runs writes and reads on every Node, following redirects', async () => {
        const writes = await results(...KEYS.map((k, i) => `SET ${k} v${i}`));
        const reads = await results(...KEYS.map((k) => `GET ${k}`));

        expect(shapes(writes)).toEqual(KEYS.map(() => ['status', 'OK']));
        expect(shapes(reads)).toEqual(KEYS.map((_, i) => ['bulk', `v${i}`]));
        // the Keys really are spread over the cluster
        const owners = masters.filter(
            (address) =>
                // KEYS lists only what that Node itself holds
                cli(nodeRemap()[address] || address, 'KEYS', `${PREFIX}:k*`) !==
                ''
        );
        expect(owners.length).toBeGreaterThan(1);
        // a command with a Key names no Node
        expect(reads.every((r) => !('node' in r))).toBe(true);
    });

    test('returns the same reply shapes as a standalone Connection', async () => {
        const list = await results(
            'PING',
            'PING hello',
            'ECHO "héllo 漢"',
            `SET ${tagged('s')} 1`,
            `SET ${tagged('s')} 2 GET`,
            `GET ${tagged('missing')}`,
            `INCR ${tagged('s')}`,
            `TYPE ${tagged('s')}`,
            `RENAME ${tagged('s')} ${tagged('l')}`,
            `HSET ${tagged('h')} name Ada __proto__ x`,
            `HGETALL ${tagged('h')}`,
            `HGETALL ${tagged('missing')}`,
            `LPUSH ${tagged('missing')}:no`,
            'PING'
        );

        expect(shapes(list.slice(0, 12))).toEqual([
            ['status', 'PONG'],
            ['bulk', 'hello'],
            ['bulk', 'héllo 漢'],
            ['status', 'OK'],
            ['bulk', '1'],
            ['nil', null],
            ['integer', 3],
            ['status', 'string'],
            ['status', 'OK'],
            ['integer', 2],
            ['array', ['name', 'Ada', '__proto__', 'x']],
            ['array', []]
        ]);
        expect(list[12]).toMatchObject({
            kind: 'error',
            reply: expect.stringMatching(/^ERR wrong number of arguments/)
        });
        expect(list[13].kind).toBe('not-run');
    });

    test('returns pairs, INFO and CLIENT LIST as a standalone Connection does', async () => {
        await run([`DEL ${tagged('z')}`]).expect(200);
        const owner = tagged('z');
        // the Console has no ZADD
        const redis = require('../../services/redis');
        const keyStore = require('../../services/keyStore');
        await keyStore.run(CONN, ['ZADD', owner, '1.5', 'a', '2', 'b']);
        redis.dropTopology(CONN);

        const [scores, members, config, info, empty, clients] = await results(
            `ZRANGE ${owner} 0 -1 withscores`,
            `ZRANGE ${owner} 0 -1`,
            'CONFIG GET maxmemory',
            'INFO server',
            'INFO no-such-section',
            'CLIENT LIST'
        );

        expect(scores.reply).toEqual([
            ['a', '1.5'],
            ['b', '2']
        ]);
        expect(members.reply).toEqual(['a', 'b']);
        expect(config.reply).toEqual(['maxmemory', expect.any(String)]);
        expect(info).toMatchObject({
            kind: 'bulk',
            reply: expect.stringMatching(/^# Server\r\nredis_version:/)
        });
        expect(empty).toMatchObject({ kind: 'bulk', reply: '' });
        expect(clients).toMatchObject({
            kind: 'bulk',
            reply: expect.stringMatching(/^id=\d+ /)
        });
    });

    test('names the Node that answered a command without a Key', async () => {
        const list = await results(
            'PING',
            'ECHO a',
            'DBSIZE',
            'SCAN 0',
            `KEYS ${PREFIX}:none`,
            'RANDOMKEY',
            'INFO server',
            'SLOWLOG GET 1',
            'CLIENT LIST',
            'CONFIG GET maxmemory'
        );

        expect(list.map((r) => r.kind)).not.toContain('error');
        const [node] = list.map((r) => r.node);
        expect(masters).toContain(node);
        expect(list.map((r) => r.node)).toEqual(list.map(() => node));
        // the name is true: that Node's port is in its INFO
        expect(list[6].reply).toContain(`tcp_port:${node.split(':')[1]}`);
    });

    test('continues a SCAN on the Node that started it', async () => {
        await results(...KEYS.map((k) => `SET ${k} v`));
        const nodes = new Set();
        const found = [];
        let cursor = '0';
        do {
            const [page] = await results(
                `SCAN ${cursor} MATCH ${PREFIX}:* COUNT 2`
            );
            nodes.add(page.node);
            found.push(...page.reply[1]);
            cursor = page.reply[0];
        } while (cursor !== '0');

        const [all] = await results(`KEYS ${PREFIX}:*`);

        expect([...nodes]).toEqual([all.node]);
        expect(found.sort()).toEqual(all.reply.sort());
        expect(found.length).toBeGreaterThan(0);
    });

    test('counts every redis-cli process against the Connection cap', async () => {
        await results('PING'); // topology resolved
        spawns.reset();

        await Promise.all(KEYS.map((key) => run([`GET ${key}`]).expect(200)));

        expect(spawns.count).toBe(KEYS.length);
        expect(spawns.peak).toBeLessThanOrEqual(4);
    });

    test('returns Redis errors and stops the run', async () => {
        const list = await results(
            `SET ${tagged('s')} v`,
            `HGETALL ${tagged('s')}`,
            'PING'
        );

        expect(list.map((r) => r.kind)).toEqual(['status', 'error', 'not-run']);
        expect(list[1].reply).toBe(
            'WRONGTYPE Operation against a key holding the wrong kind of value'
        );
        const [slots] = await results(`DEL ${KEYS[0]} ${KEYS[1]} ${KEYS[2]}`);
        expect(slots.reply).toMatch(/^CROSSSLOT/);
    });

    test('scrubs Connection config from error text', async () => {
        const user = 'test-console07-user';
        const id = 'test-cluster-console-acl';
        const addresses = masters.map((a) => nodeRemap()[a] || a);
        // may PING and read the Node list, nothing else
        addresses.forEach((a) =>
            cli(
                a,
                'ACL',
                'SETUSER',
                user,
                'on',
                '>pw',
                '+ping',
                '+cluster|nodes'
            )
        );
        createConnection({
            id,
            host: HOST,
            port: Number(PORT),
            cluster: true,
            username: user,
            password: 'pw'
        });
        try {
            for (const [text, command] of [
                ['GET any', 'get'],
                ['INFO', 'info'],
                ['CLIENT LIST', 'client|list']
            ]) {
                const { body } = await run([text], id).expect(200);

                expect(body.results[0]).toMatchObject({
                    kind: 'error',
                    reply: expect.stringMatching(/^NOPERM .*\*\*\*/)
                });
                expect(body.results[0].reply).toContain(`'${command}'`);
                expect(body.results[0].reply).not.toContain(user);
            }
        } finally {
            deleteConnection(id);
            addresses.forEach((a) => cli(a, 'ACL', 'DELUSER', user));
        }
    });

    test('reports an unreachable cluster, scrubbed', async () => {
        const id = 'test-cluster-console-down';
        createConnection({ id, host: '127.0.0.1', port: 1, cluster: true });
        try {
            for (const text of ['PING', 'GET any']) {
                const { body } = await run([text], id).expect(200);

                expect(body.results[0].kind).toBe('error');
                expect(body.results[0].reply).toMatch(/connect|refused/i);
                expect(body.results[0].reply).not.toContain('127.0.0.1');
            }
        } finally {
            deleteConnection(id);
        }
    });

    test('does not log Console commands, also when they fail', async () => {
        await results('PING'); // the topology lookup is not a Console command
        const secret = `${PREFIX}:never-logged`;
        const spies = ['log', 'info', 'warn', 'error', 'debug'].map((method) =>
            jest.spyOn(console, method)
        );

        await results(`GET ${secret}`, `ECHO ${secret}`, `GET ${secret} extra`);

        const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
        spies.forEach((spy) => spy.mockRestore());
        expect(output).not.toContain('never-logged');
    });
});
