const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');

const RO = 'test-guard-ro';
const CW = 'test-guard-cw';
const app = createApp();

function addConn(id, flags) {
    db.prepare(
        `INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
         VALUES (?, ?, ?, '', '', 0, 0, 998, 'production', ?, ?)`
    ).run(
        id,
        process.env.REDIS_TEST_HOST || '127.0.0.1',
        parseInt(process.env.REDIS_TEST_PORT || '6379'),
        flags.ro ? 1 : 0,
        flags.cw ? 1 : 0
    );
}

beforeAll(() => {
    addConn(RO, { ro: true });
    addConn(CW, { cw: true });
});
afterAll(() => {
    db.prepare('DELETE FROM connections WHERE id IN (?, ?)').run(RO, CW);
});
afterEach(async () => {
    await execRedisCommand('DEL "test:guard:k"', global.TEST_CONNECTION_ID);
});

// [label, call(env) => supertest request]
const writes = [
    [
        'POST /keys',
        (env) =>
            request(app)
                .post('/api/keys')
                .query({ env })
                .send({ key: 'test:guard:k', value: 'v' })
    ],
    [
        'DELETE /keys/:key',
        (env) => request(app).delete('/api/keys/test:guard:k').query({ env })
    ],
    [
        'DELETE /allkeys',
        (env) =>
            request(app)
                .delete('/api/allkeys')
                .query({ env, pattern: 'test:guard:*' })
    ],
    [
        'POST /keys/:key/rename',
        (env) =>
            request(app)
                .post('/api/keys/test:guard:k/rename')
                .query({ env })
                .send({ newKey: 'test:guard:k2' })
    ],
    [
        'POST /keys/:key/expire',
        (env) =>
            request(app)
                .post('/api/keys/test:guard:k/expire')
                .query({ env })
                .send({ seconds: 100 })
    ],
    [
        'POST /keys/:key/copy (target)',
        (env) =>
            request(app)
                .post('/api/keys/test:guard:k/copy')
                .query({ env: global.TEST_CONNECTION_ID })
                .send({ targetKey: 'test:guard:k2', targetEnv: env })
    ],
    [
        'POST /keys/:key/zadd',
        (env) =>
            request(app)
                .post('/api/keys/test:guard:k/zadd')
                .query({ env })
                .send({ members: [{ value: 'a', score: 1 }] })
    ],
    [
        'POST /flush',
        (env) =>
            request(app)
                .post('/api/flush')
                .query({ env })
                .send({ confirm: true })
    ],
    [
        'POST /exec (SET)',
        (env) =>
            request(app)
                .post('/api/exec')
                .send({ env, command: 'SET test:guard:k v' })
    ]
];

describe('write guard: Read-only connection', () => {
    test.each(writes)('%s -> 403', async (_l, call) => {
        const res = await call(RO);
        expect(res.status).toBe(403);
    });

    test('a refused write does not reach Redis', async () => {
        await request(app)
            .post('/api/keys')
            .query({ env: RO })
            .send({ key: 'test:guard:k', value: 'v' });
        const v = await execRedisCommand(
            'EXISTS test:guard:k',
            global.TEST_CONNECTION_ID
        );
        expect(v).toBe('0');
    });
});

describe('write guard: Confirm-writes connection', () => {
    test.each(writes)('%s -> 428 without header', async (_l, call) => {
        const res = await call(CW);
        expect(res.status).toBe(428);
    });

    test('wrong header -> 428', async () => {
        const res = await request(app)
            .post('/api/keys')
            .query({ env: CW })
            .set('X-Confirm-Connection', 'something-else')
            .send({ key: 'test:guard:k', value: 'v' });
        expect(res.status).toBe(428);
    });

    test('matching header lets the write through', async () => {
        const res = await request(app)
            .post('/api/exec')
            .set('X-Confirm-Connection', CW)
            .send({ env: CW, command: 'SET test:guard:k v' });
        expect(res.status).toBe(200);
        await execRedisCommand('DEL test:guard:k', CW);
    });
});

describe('write guard: reads pass through', () => {
    const reads = [
        ['GET /keys', (e) => request(app).get('/api/keys').query({ env: e })],
        [
            'GET /keycount',
            (e) => request(app).get('/api/keycount').query({ env: e })
        ],
        ['GET /info', (e) => request(app).get('/api/info').query({ env: e })],
        [
            'GET /keys/:key/exists',
            (e) =>
                request(app)
                    .get('/api/keys/test:guard:none/exists')
                    .query({ env: e })
        ],
        [
            'POST /exec (GET)',
            (e) =>
                request(app)
                    .post('/api/exec')
                    .send({ env: e, command: 'GET test:guard:none' })
        ],
        [
            'POST /exec (--raw dbsize)',
            (e) =>
                request(app)
                    .post('/api/exec')
                    .send({ env: e, command: '--raw dbsize' })
        ]
    ];
    test.each(reads)(
        '%s on read-only and confirm connections',
        async (_l, call) => {
            expect((await call(RO)).status).toBe(200);
            expect((await call(CW)).status).toBe(200);
        }
    );

    test('unknown command is treated as a write', async () => {
        const res = await request(app)
            .post('/api/exec')
            .send({ env: RO, command: 'FOOBAR x' });
        expect(res.status).toBe(403);
    });
});
