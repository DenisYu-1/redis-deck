// In-memory job registry (SPEC R7).
const {
    startJob,
    getJob,
    listJobs,
    cancelJob
} = require('../../services/jobs');

async function settle(id) {
    for (let i = 0; i < 100; i++) {
        const job = getJob(id);
        if (job.state !== 'running') return job;
        await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('job did not finish');
}

afterEach(() => jest.restoreAllMocks());

test('a job cancelled while it is failing ends cancelled, not failed', async () => {
    let fail;
    const job = startJob(
        't-cancel',
        'env-a',
        {},
        () =>
            new Promise((resolve, reject) => {
                fail = reject;
            })
    );
    await new Promise((r) => setImmediate(r));
    cancelJob(job.id);
    fail(new Error('connection lost'));
    expect(await settle(job.id)).toMatchObject({ state: 'cancelled' });
});

test('a second running job of the same kind on the same Connection is refused with 409', async () => {
    let finish;
    const first = startJob(
        't-busy',
        'env-b',
        {},
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    expect(() => startJob('t-busy', 'env-b', {}, async () => {})).toThrow(
        expect.objectContaining({ status: 409 })
    );
    // Other kinds and other Connections are independent.
    const other = startJob('t-busy', 'env-c', {}, async () => {});
    await new Promise((r) => setImmediate(r));
    finish();
    await settle(first.id);
    await settle(other.id);
    // Once the first one stopped, a new one may start.
    await settle(startJob('t-busy', 'env-b', {}, async () => {}).id);
});

test('finished jobs older than an hour are forgotten on get and list', async () => {
    const job = startJob('t-prune', 'env-d', {}, async () => {});
    await settle(job.id);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 2 * 60 * 60 * 1000);
    expect(listJobs({ env: 'env-d' })).toEqual([]);
    expect(getJob(job.id)).toBeNull();
});
