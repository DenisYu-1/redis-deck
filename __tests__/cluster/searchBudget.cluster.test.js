// Time-budgeted search (SPEC R5) on a clustered Connection: continuing a rare
// pattern across partial responses finds every Key exactly once.
//
//   REDIS_TEST_CLUSTER=true yarn test __tests__/cluster --runInBand
const { execFileSync } = require('child_process');
const request = require('supertest');
const { db } = require('../../services/database');
const { createApp } = require('../../config/app');
const { countRedisCliSpawns } = require('../helpers/redisCliSpawns');
const {
    enabled,
    SEED,
    clusterNodes,
    nodeRemap
} = require('../helpers/clusterTarget');

const CONN = 'test-cluster-search-budget';
const FILLER = Array.from({ length: 2400 }, (_, i) => `test:tbc:fill:${i}`);
const RARE = ['test:tbc:rare:1', 'test:tbc:rare:2', 'test:tbc:rare:3'];

// Send one command per Key to every master without -c: each master applies
// the Keys it owns and answers MOVED for the rest.
const onEveryMaster = (verb, keys) => {
    for (const { reachable } of clusterNodes()) {
        const [host, port] = reachable.split(':');
        execFileSync('redis-cli', ['-h', host, '-p', port], {
            input: keys.map((k) => `${verb} ${k}${verb === 'SET' ? ' x' : ''}`).join('\n'),
            maxBuffer: 64 * 1024 * 1024
        });
    }
};

(enabled ? describe : describe.skip)('cluster: time-budgeted search', () => {
    let spawns;

    beforeAll(() => {
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
        const [host, port] = SEED.split(':');
        db.prepare(
            'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 995)'
        ).run(CONN, host, parseInt(port));
        spawns = countRedisCliSpawns({ remap: nodeRemap() });
        onEveryMaster('SET', [...FILLER, ...RARE]);
    }, 60000);

    afterAll(() => {
        onEveryMaster('DEL', [...FILLER, ...RARE]);
        spawns.restore();
        db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    }, 60000);

    test('continuing a rare pattern finds every Key exactly once', async () => {
        const app = createApp({ searchBudgetMs: 0 });
        const found = [];
        let cursors = ['0'];
        let requests = 0;
        let hasMore = true;
        while (hasMore) {
            const { body } = await request(app)
                .get('/api/keys')
                .query({
                    env: CONN,
                    pattern: 'test:tbc:rare:*',
                    count: 50,
                    cursors: JSON.stringify(cursors)
                })
                .expect(200);
            expect(body.failedNodes).toEqual([]);
            found.push(...body.keys);
            cursors = body.cursors;
            hasMore = body.hasMore;
            requests++;
        }
        expect(requests).toBeGreaterThan(1);
        expect([...found].sort()).toEqual([...RARE].sort());
    }, 60000);
});
