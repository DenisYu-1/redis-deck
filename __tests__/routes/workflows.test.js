const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../../config/app');
const { db } = require('../../services/database');
const { execRedisCommand } = require('../../services/redis');

const RO = 'test-wf-ro';
const CW = 'test-wf-cw';
const app = createApp();
const SET = 'examples.set-marker';
const COUNT = 'examples.count-keys';
const UUID = '123e4567-e89b-42d3-a456-426614174000';

function addConn(id, flags) {
    db.prepare(
        `INSERT INTO connections (id, host, port, username, password, tls, cluster, \`order\`, tier, read_only, confirm_writes)
         VALUES (?, ?, ?, '', '', 0, 0, 997, 'production', ?, ?)`
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
    db.prepare('DELETE FROM workflow_runs WHERE connection_id LIKE ?').run(
        'test-%'
    );
    db.prepare('DELETE FROM connections WHERE id IN (?, ?)').run(RO, CW);
});
afterEach(async () => {
    await execRedisCommand('DEL workflow:example:7', global.TEST_CONNECTION_ID);
});

const plan = (id, body) =>
    request(app).post(`/api/workflows/${id}/plan`).send(body);
const run = (id, body, headers = {}) =>
    request(app).post(`/api/workflows/${id}/run`).set(headers).send(body);
const history = (id) => request(app).get(`/api/workflows/${id}/history`);
const local = () => global.TEST_CONNECTION_ID;

describe('GET /api/workflows', () => {
    it('lists plugins with their actions and input manifest', async () => {
        const res = await request(app).get('/api/workflows');
        expect(res.status).toBe(200);
        const plugin = res.body.plugins.find((p) => p.id === 'examples');
        const action = plugin.actions.find((a) => a.id === 'set-marker');
        expect(action.fullId).toBe(SET);
        expect(action.writes).toBe(true);
        expect(action.inputs.map((i) => i.type)).toEqual([
            'int',
            'uuid',
            'select'
        ]);
    });
});

describe('plan', () => {
    it('dry-runs without writing', async () => {
        const res = await plan(SET, { env: local(), inputs: { id: '7' } });
        expect(res.status).toBe(200);
        expect(res.body.plan.text).toMatch(/workflow:example:7/);
        const v = await execRedisCommand('EXISTS workflow:example:7', local());
        expect(String(v)).toBe('0');
    });

    it.each([
        [{}, /marker id.*required/i],
        [{ id: 'abc' }, /marker id.*integer/i],
        [{ id: '7', token: 'nope' }, /token.*uuid/i],
        [{ id: '7', ttl: '5' }, /expires in.*one of/i]
    ])('rejects invalid inputs %j', async (inputs, msg) => {
        const res = await plan(SET, { env: local(), inputs });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(msg);
    });

    it('404s for an unknown workflow and rejects traversal ids', async () => {
        const body = { env: local(), inputs: {} };
        expect((await plan('examples.nope', body)).status).toBe(404);
        expect((await plan('..%2Fx.y', body)).status).toBe(404);
    });

    it('is allowed on a read-only connection (it writes nothing)', async () => {
        const res = await plan(SET, { env: RO, inputs: { id: '7' } });
        expect(res.status).toBe(200);
    });
});

describe('run', () => {
    it('applies defaults, executes, and records history', async () => {
        const res = await run(SET, {
            env: local(),
            inputs: { id: '7', token: UUID }
        });
        expect(res.status).toBe(200);
        expect(res.body.result.ok).toBe(true);
        const v = await execRedisCommand('GET workflow:example:7', local());
        expect(String(v)).toContain(UUID);
        const ttl = await execRedisCommand('TTL workflow:example:7', local());
        expect(Number(ttl)).toBeGreaterThan(0);

        const hist = await history(SET);
        expect(hist.status).toBe(200);
        const row = hist.body.runs[0];
        expect(row).toMatchObject({
            connection: local(),
            tier: 'local',
            ok: true,
            inputs: { id: 7, token: UUID, ttl: '60' }
        });
        expect(typeof row.at).toBe('number');
        expect(row.text).toMatch(/workflow:example:7/);
    });

    it('does not record or run invalid input', async () => {
        const before = (await history(SET)).body.runs.length;
        const res = await run(SET, { env: local(), inputs: { id: 'x' } });
        expect(res.status).toBe(400);
        expect((await history(SET)).body.runs.length).toBe(before);
    });

    it('blocks writes:true on a read-only connection (403)', async () => {
        const res = await run(SET, { env: RO, inputs: { id: '7' } });
        expect(res.status).toBe(403);
        const rows = (await history(SET)).body.runs;
        expect(rows.find((r) => r.connection === RO)).toBeUndefined();
    });

    it('asks confirm-writes connections for X-Confirm-Connection (428)', async () => {
        const body = { env: CW, inputs: { id: '7' } };
        expect((await run(SET, body)).status).toBe(428);
        const ok = await run(SET, body, { 'X-Confirm-Connection': CW });
        expect(ok.status).toBe(200);
        await execRedisCommand('DEL workflow:example:7', CW);
    });

    it('lets non-writing workflows run on a read-only connection', async () => {
        const res = await run(COUNT, { env: RO, inputs: {} });
        expect(res.status).toBe(200);
        expect(res.body.result.text).toMatch(/\d+ keys/);
    });

    it('requires env and a known connection', async () => {
        expect((await run(SET, { inputs: { id: '7' } })).status).toBe(400);
        const res = await run(SET, {
            env: 'test-wf-missing',
            inputs: { id: '7' }
        });
        expect(res.status).toBe(404);
    });
});

describe('External Plugins in DATA_DIR/plugins', () => {
    let dataDir;
    let prevDataDir;
    const pluginsDir = () => path.join(dataDir, 'plugins');

    function writeExternal(manifest, handlers = {}) {
        fs.mkdirSync(pluginsDir(), { recursive: true });
        fs.writeFileSync(
            path.join(pluginsDir(), 'config.json'),
            typeof manifest === 'string' ? manifest : JSON.stringify(manifest)
        );
        for (const [rel, source] of Object.entries(handlers)) {
            const file = path.join(pluginsDir(), `${rel}.js`);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, source);
        }
    }
    const handler = (planText, runText) =>
        `module.exports = {
            async plan() { return { text: ${JSON.stringify(planText)} }; },
            async run() { return { text: ${JSON.stringify(runText)} }; }
        };`;
    const listed = async () =>
        (await request(app).get('/api/workflows')).body.plugins;

    beforeAll(() => {
        prevDataDir = process.env.DATA_DIR;
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redis-deck-ext-'));
        process.env.DATA_DIR = dataDir;
    });
    afterAll(() => {
        if (prevDataDir === undefined) delete process.env.DATA_DIR;
        else process.env.DATA_DIR = prevDataDir;
        fs.rmSync(dataDir, { recursive: true, force: true });
    });
    afterEach(() => {
        fs.rmSync(pluginsDir(), { recursive: true, force: true });
    });

    it('lists an External Plugin and plans and runs its handler', async () => {
        writeExternal(
            {
                plugins: [
                    {
                        id: 'ext-demo',
                        name: 'External demo',
                        actions: [{ id: 'hello', title: 'Hello' }]
                    }
                ]
            },
            { 'ext-demo/hello': handler('ext plan', 'ext run') }
        );
        const plugin = (await listed()).find((p) => p.id === 'ext-demo');
        expect(plugin.name).toBe('External demo');
        expect(plugin.actions.map((a) => a.fullId)).toEqual(['ext-demo.hello']);

        const p = await plan('ext-demo.hello', { env: local(), inputs: {} });
        expect(p.status).toBe(200);
        expect(p.body.plan.text).toBe('ext plan');
        const r = await run('ext-demo.hello', { env: local(), inputs: {} });
        expect(r.status).toBe(200);
        expect(r.body.result).toMatchObject({ ok: true, text: 'ext run' });
    });

    it('replaces a built-in Plugin with the same id', async () => {
        writeExternal(
            {
                plugins: [
                    {
                        id: 'examples',
                        name: 'My examples',
                        actions: [{ id: 'count-keys', title: 'Count' }]
                    }
                ]
            },
            { 'examples/count-keys': handler('mine', 'my count') }
        );
        const plugin = (await listed()).find((p) => p.id === 'examples');
        expect(plugin.name).toBe('My examples');
        expect(plugin.actions.map((a) => a.id)).toEqual(['count-keys']);
        const r = await run(COUNT, { env: local(), inputs: {} });
        expect(r.body.result.text).toBe('my count');
    });

    it('hides a built-in Plugin declared with enabled: false', async () => {
        writeExternal({ plugins: [{ id: 'examples', enabled: false }] });
        expect((await listed()).map((p) => p.id)).not.toContain('examples');
        const r = await run(COUNT, { env: local(), inputs: {} });
        expect(r.status).toBe(404);
    });

    it('ignores a malformed manifest', async () => {
        writeExternal('{ "plugins": [ oops');
        const res = await request(app).get('/api/workflows');
        expect(res.status).toBe(200);
        expect(res.body.plugins.map((p) => p.id)).toContain('examples');
    });

    it('skips badly shaped entries and keeps the rest', async () => {
        writeExternal(
            {
                plugins: [
                    null,
                    'examples',
                    { id: 'examples', actions: {} },
                    { id: 'examples', actions: 'x' },
                    { name: 'No id', actions: [{ id: 'hello' }] },
                    { id: 'ext-demo', actions: [{ id: 'hello' }] }
                ]
            },
            { 'ext-demo/hello': handler('ext plan', 'ext run') }
        );
        const res = await request(app).get('/api/workflows');
        expect(res.status).toBe(200);
        const ids = res.body.plugins.map((p) => p.id);
        expect(ids).toContain('ext-demo');
        const examples = res.body.plugins.find((p) => p.id === 'examples');
        expect(examples.actions.map((a) => a.fullId)).toContain(COUNT);
        expect(res.body.plugins.find((p) => !p.id)).toBeUndefined();
    });

    it('leaves a Plugin with no handler on disk unlisted', async () => {
        writeExternal({
            plugins: [{ id: 'ext-ghost', actions: [{ id: 'boo' }] }]
        });
        expect((await listed()).map((p) => p.id)).not.toContain('ext-ghost');
    });

    it('sends External write Workflows through the write guard', async () => {
        writeExternal(
            {
                plugins: [
                    {
                        id: 'ext-demo',
                        actions: [{ id: 'write', writes: true }]
                    }
                ]
            },
            { 'ext-demo/write': handler('would write', 'wrote') }
        );
        const res = await run('ext-demo.write', { env: RO, inputs: {} });
        expect(res.status).toBe(403);
    });
});
