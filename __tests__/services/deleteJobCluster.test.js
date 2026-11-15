// Delete job on a cluster when a reshard moves Keys between the scan and the
// delete: MOVED replies are retried once on the owner; whatever is still not
// deleted is reported on the job.
jest.mock('../../services/redis', () => ({
    isClusterMode: jest.fn().mockResolvedValue(true),
    execArgv: jest.fn(),
    execArgvBatch: jest.fn(),
    getClusterNodes: jest.fn(),
    scanClusterNodes: jest.fn()
}));
const {
    execArgvBatch,
    getClusterNodes,
    scanClusterNodes
} = require('../../services/redis');
const { startDeleteJob } = require('../../services/deleteJob');
const { getJob } = require('../../services/jobs');

const A = { id: 'a', host: '10.0.0.1', port: 7000 };
const B = { id: 'b', host: '10.0.0.2', port: 7001 };

async function settle(id) {
    for (let i = 0; i < 100; i++) {
        const job = getJob(id);
        if (job.state !== 'running') return job;
        await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('job did not finish');
}

beforeEach(() => {
    jest.clearAllMocks();
    getClusterNodes.mockResolvedValue([A, B]);
    scanClusterNodes.mockResolvedValue({
        keys: ['kept', 'moved', 'broken', 'lost'],
        keyNodes: { kept: A, moved: A, broken: A, lost: A },
        cursors: ['done', 'done'],
        hasMore: false,
        failedNodes: []
    });
});

test('MOVED Keys are deleted on their new owner; the rest are reported', async () => {
    execArgvBatch.mockImplementation(async (commands, env, node) => {
        const keys = commands.map(([, key]) => key);
        if (node === A) {
            expect(keys).toEqual(['kept', 'moved', 'broken', 'lost']);
            return [
                { value: 1 },
                { error: 'MOVED 1 10.0.0.2:7001' },
                { error: 'ERR boom' },
                { error: 'MOVED 2 10.0.0.2:7001' }
            ];
        }
        expect(node).toEqual(B);
        expect(keys).toEqual(['moved', 'lost']);
        return [{ value: 1 }, { error: 'MOVED 2 10.0.0.1:7000' }];
    });

    const job = startDeleteJob(global.TEST_CONNECTION_ID, { pattern: 'k*' });
    const done = await settle(job.id);

    expect(execArgvBatch).toHaveBeenCalledTimes(2);
    expect(done.state).toBe('done');
    expect(done.progress).toMatchObject({
        scanned: 4,
        deleted: 2,
        failed: 2,
        failedKeys: [
            { key: 'broken', error: 'ERR boom' },
            { key: 'lost', error: 'MOVED 2 10.0.0.1:7000' }
        ]
    });
});
