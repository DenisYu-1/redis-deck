// The Scan cursor set holds one cursor per Node by position, so the Node order
// must not depend on the order CLUSTER NODES happens to print them in.
const childProcess = require('child_process');
const { db } = require('../../services/database');
const { getClusterNodes, dropTopology } = require('../../services/redis');

const CONN = 'test-node-order';
const line = (id, port) =>
    `${id} 10.0.0.1:${port}@1${port} master - 0 0 1 connected`;

beforeAll(() => {
    db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
    db.prepare(
        'INSERT INTO connections (id, host, port, cluster, `order`) VALUES (?, ?, ?, 1, 990)'
    ).run(CONN, '127.0.0.1', 1);
});
afterAll(() => {
    db.prepare('DELETE FROM connections WHERE id = ?').run(CONN);
});
afterEach(() => {
    jest.restoreAllMocks();
    dropTopology(CONN);
});

function clusterNodesReply(text) {
    jest.spyOn(childProcess, 'execFile').mockImplementation(
        (file, args, opts, cb) => {
            setImmediate(() => cb(null, text, ''));
            return { stdin: { write() {}, end() {} } };
        }
    );
}

test('Nodes come back sorted by id whatever order CLUSTER NODES uses', async () => {
    clusterNodesReply(
        [line('ccc', 7002), line('aaa', 7000), line('bbb', 7001)].join('\n')
    );
    const first = (await getClusterNodes(CONN)).map((n) => n.id);
    dropTopology(CONN);
    clusterNodesReply(
        [line('bbb', 7001), line('ccc', 7002), line('aaa', 7000)].join('\n')
    );
    const second = (await getClusterNodes(CONN)).map((n) => n.id);
    expect(first).toEqual(['aaa', 'bbb', 'ccc']);
    expect(second).toEqual(first);
});
