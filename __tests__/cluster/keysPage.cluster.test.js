// Opt-in cluster suite (spec docs/perf-cluster-scan/SPEC.md, ADR 0002).
// Skipped unless REDIS_TEST_CLUSTER is set. Value: seed `host:port`, or `true`
// for the local cluster on 127.0.0.1:5379. Nodes that announce addresses the
// host cannot reach (Docker-internal names) are remapped onto
// REDIS_TEST_CLUSTER_NODES (comma-separated reachable host:port, matched by
// CLUSTER MYID; default = the local cluster's published ports).
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster
const { execFileSync } = require('child_process');
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const keyStore = require('../../services/keyStore');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const { clusterNodes } = require('../helpers/clusterTarget');

const FLAG = process.env.REDIS_TEST_CLUSTER;
const enabled = Boolean(FLAG) && FLAG !== 'false';
const SEED = !enabled || FLAG === 'true' ? '127.0.0.1:5379' : FLAG;
const REACHABLE = (
    process.env.REDIS_TEST_CLUSTER_NODES ||
    '127.0.0.1:5379,127.0.0.1:53791,127.0.0.1:53792'
).split(',');
const CONN = 'test-cluster';
const PREFIX = 'test:perfpage:';

const cli = (addr, ...argv) => {
    const [host, port] = addr.split(':');
    return execFileSync('redis-cli', ['-h', host, '-p', port, ...argv], {
        encoding: 'utf8'
    }).trim();
};

// announced address -> reachable address, for Nodes the host cannot reach.
function nodeRemap() {
    const byId = {};
    for (const addr of REACHABLE) {
        try {
            byId[cli(addr, 'CLUSTER', 'MYID')] = addr;
        } catch {
            // not part of this setup
        }
    }
    const remap = {};
    for (const line of cli(SEED, 'CLUSTER', 'NODES').split('\n')) {
        const [id, address] = line.split(' ');
        const announced = address.split('@')[0];
        if (byId[id] && byId[id] !== announced) {
            remap[announced] = byId[id];
        }
    }
    return remap;
}

// 50 Keys, every type the editor writes, every third one with a TTL.
const TYPES = ['string', 'hash', 'list', 'set', 'zset'];
const VALUES = {
    string: 'v',
    hash: { f: 'v' },
    list: ['a', 'b'],
    set: ['a', 'b'],
    zset: [{ member: 'a', score: 1 }]
};
const FIXTURE = Array.from({ length: 50 }, (_, i) => ({
    key: `${PREFIX}${i}`,
    type: TYPES[i % TYPES.length],
    ttl: i % 3 === 0 ? 3600 : 0
}));

(enabled ? describe : describe.skip)('cluster: one Keys page', () => {
    const app = createApp();
    let spawns;

    beforeAll(async () => {
        const [host, port] = SEED.split(':');
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 998)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
        for (const { key, type, ttl } of FIXTURE) {
            await keyStore.writeKey(CONN, key, type, VALUES[type], ttl);
        }
    }, 60000);

    afterAll(async () => {
        for (const { key } of FIXTURE) {
            await keyStore.deleteKey(CONN, key);
        }
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    }, 60000);

    // Baseline before perf work (local 3-Node cluster, 2026-11): 192 spawns
    // per page = 8 for scanning (2 hops x (CLUSTER NODES + 3 SCAN)) + 184 for
    // Page meta (50 TYPE on the seed, 34 MOVED retries, 50 TTL, 50 MEMORY).
    // Scan hops vary with the cluster's other data, so only Page meta is
    // gated: at most one batched spawn per Node per page (SPEC R1).
    const isScanSpawn = (args) =>
        args.includes('--csv') || args.includes('CLUSTER');

    test('a 50-Key page returns the same Keys, types and TTLs as the per-Key path with <= 1 Page meta spawn per Node, and no size', async () => {
        const masters = clusterNodes();
        spawns.reset();
        const { body } = await request(app)
            .get('/api/keys')
            .query({ env: CONN, pattern: `${PREFIX}*`, count: 50 })
            .expect(200);
        const pageMetaSpawns = spawns.spawns.filter(
            (args) => !isScanSpawn(args)
        ).length;

        expect([...body.keys].sort()).toEqual(FIXTURE.map((f) => f.key).sort());
        for (const { key, type, ttl } of FIXTURE) {
            const meta = body.meta[key];
            expect(meta.type).toBe(type);
            if (ttl) {
                expect(meta.ttl).toBeGreaterThan(3500);
                expect(meta.ttl).toBeLessThanOrEqual(3600);
            } else {
                expect(meta.ttl).toBe(-1);
            }
            expect(meta).not.toHaveProperty('size'); // lazy (SPEC R4)
            expect(masters.map((n) => n.id)).toContain(meta.node);
        }
        expect(pageMetaSpawns).toBeLessThanOrEqual(masters.length);
    });

    test('POST /keys/sizes equals the per-Key MEMORY USAGE path, null for a missing Key, <= 1 spawn per Node', async () => {
        const masters = clusterNodes();
        // The old per-Key path (TYPE, MOVED retry, MEMORY USAGE) as reference.
        const expectedSize = {};
        for (const { key } of FIXTURE) {
            expectedSize[key] = (await keyStore.readMeta(CONN, key)).memory;
        }
        const { body: page } = await request(app)
            .get('/api/keys')
            .query({ env: CONN, pattern: `${PREFIX}*`, count: 50 })
            .expect(200);
        const items = page.keys.map((key) => ({
            key,
            node: page.meta[key].node
        }));
        spawns.reset();
        const { body } = await request(app)
            .post('/api/keys/sizes')
            .query({ env: CONN })
            .send({ keys: items })
            .expect(200);
        expect(spawns.count).toBeLessThanOrEqual(masters.length);
        expect(body.sizes).toEqual(expectedSize);

        // A Key deleted after the page loaded: its Node answers nil.
        const { key, node } = items[0];
        await keyStore.deleteKey(CONN, key);
        try {
            const { body: gone } = await request(app)
                .post('/api/keys/sizes')
                .query({ env: CONN })
                .send({ keys: [{ key, node }] })
                .expect(200);
            expect(gone.sizes).toEqual({ [key]: null });
        } finally {
            const f = FIXTURE.find((x) => x.key === key);
            await keyStore.writeKey(CONN, key, f.type, VALUES[f.type], f.ttl);
        }
    });

    test('a TTL filter makes <= 1 Page meta spawn per Node per request, and continuing finds every match', async () => {
        const masters = clusterNodes();
        const prefix = 'test:perfttl:';
        const withTtl = Array.from({ length: 10 }, (_, i) => `${prefix}t${i}`);
        // Many non-matching Keys, so the sweep takes several SCAN hops.
        const filler = Array.from(
            { length: 2000 },
            (_, i) => `${prefix}{fill}${i}`
        );
        for (const key of withTtl) {
            await keyStore.writeKey(CONN, key, 'string', 'v', 3600);
            await keyStore.writeKey(CONN, `${key}:none`, 'string', 'v', 0);
        }
        await keyStore.run(CONN, ['MSET', ...filler.flatMap((k) => [k, 'v'])]);
        try {
            const found = [];
            let cursors;
            let hasMore = true;
            for (let i = 0; hasMore && i < 50; i++) {
                spawns.reset();
                const { body } = await request(app)
                    .get('/api/keys')
                    .query({
                        env: CONN,
                        pattern: `${prefix}*`,
                        count: 50,
                        ttl: 'has',
                        ...(cursors && { cursors: JSON.stringify(cursors) })
                    })
                    .expect(200);
                const pageMetaSpawns = spawns.spawns.filter(
                    (args) => !isScanSpawn(args)
                ).length;
                expect(pageMetaSpawns).toBeLessThanOrEqual(masters.length);
                body.keys.forEach((k) =>
                    expect(body.meta[k].ttl).toBeGreaterThan(0)
                );
                found.push(...body.keys);
                ({ cursors, hasMore } = body);
            }
            expect(hasMore).toBe(false);
            expect([...new Set(found)].sort()).toEqual([...withTtl].sort());
        } finally {
            await keyStore.run(CONN, ['DEL', ...filler]);
            for (const key of withTtl) {
                await keyStore.deleteKey(CONN, key);
                await keyStore.deleteKey(CONN, `${key}:none`);
            }
        }
    }, 60000);
});
