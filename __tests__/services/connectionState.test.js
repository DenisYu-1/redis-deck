// Per-Connection in-memory state: the redis-cli process cap (SPEC R2) and the
// topology cache (SPEC R3).
const {
    limitCli,
    MAX_CLI_PER_CONNECTION
} = require('../../services/connectionState');

const tick = () => new Promise((r) => setTimeout(r, 5));

test('at most MAX_CLI_PER_CONNECTION tasks run at once per Connection', async () => {
    let active = 0;
    let peak = 0;
    const task = async () => {
        active++;
        peak = Math.max(peak, active);
        await tick();
        active--;
    };
    await Promise.all(
        Array.from({ length: 10 }, () => limitCli('cap-a', task))
    );
    expect(peak).toBe(MAX_CLI_PER_CONNECTION);
});

test('a task that throws synchronously rejects and frees its slot', async () => {
    const boom = () => {
        throw new Error('boom');
    };
    for (let i = 0; i < MAX_CLI_PER_CONNECTION + 1; i++) {
        await expect(limitCli('cap-b', boom)).rejects.toThrow('boom');
    }
    await expect(limitCli('cap-b', async () => 'ran')).resolves.toBe('ran');
});

describe('execArgvBatch', () => {
    const childProcess = require('child_process');
    const { execArgvBatch } = require('../../services/redis');
    const {
        cacheTopology,
        cachedTopology
    } = require('../../services/connectionState');

    afterEach(() => jest.restoreAllMocks());

    test('a reply-count mismatch drops the cached topology', async () => {
        const env = global.TEST_CONNECTION_ID;
        cacheTopology(env, [{ id: 'n1', host: 'h', port: 1 }]);
        jest.spyOn(childProcess, 'execFile').mockImplementation(
            (file, args, opts, cb) => {
                setImmediate(() => cb(null, '1\n', ''));
                return { stdin: { write() {}, end() {} } };
            }
        );
        await expect(
            execArgvBatch(
                [
                    ['UNLINK', 'a'],
                    ['UNLINK', 'b']
                ],
                env
            )
        ).rejects.toMatchObject({ message: 'Expected 2 replies, got 1' });
        expect(cachedTopology(env)).toBeNull();
    });
});
