const {
    db,
    createConnection,
    getConnection,
    getConnectionConfig,
    getAllConnections,
    updateConnection
} = require('../../services/database');
const { connArgs } = require('../../services/redis');

const ID = 'test-safety-conn';

afterEach(() => {
    db.prepare('DELETE FROM connections WHERE id = ?').run(ID);
});

describe('connection safety columns', () => {
    test('migration adds columns with safe defaults to existing rows', () => {
        const cols = db
            .prepare('PRAGMA table_info(connections)')
            .all()
            .map((c) => c.name);
        expect(cols).toEqual(
            expect.arrayContaining([
                'tier',
                'db',
                'verify_tls',
                'read_only',
                'confirm_writes'
            ])
        );
        // legacy-style insert (no new columns) still works and gets defaults
        db.prepare(
            'INSERT INTO connections (id, host, port) VALUES (?, ?, ?)'
        ).run(ID, '127.0.0.1', 6379);
        const row = getConnection(ID);
        expect(row).toMatchObject({
            tier: 'local',
            db: 0,
            verify_tls: 1,
            read_only: 0,
            confirm_writes: 0
        });
    });

    test('create/update round-trip and list exposes them as typed fields', () => {
        createConnection({
            id: ID,
            host: 'h',
            port: 1,
            tier: 'production',
            db: 3,
            verifyTls: false,
            readOnly: true,
            confirmWrites: true
        });
        const listed = getAllConnections().find((c) => c.id === ID);
        expect(listed).toMatchObject({
            tier: 'production',
            db: 3,
            verifyTls: false,
            readOnly: true,
            confirmWrites: true
        });
        expect(listed.password).toBeUndefined();

        updateConnection(ID, {
            host: 'h',
            port: 1,
            tier: 'staging',
            db: 1,
            verifyTls: true,
            readOnly: false,
            confirmWrites: false
        });
        expect(getConnectionConfig(ID)).toMatchObject({
            tier: 'staging',
            db: 1,
            verifyTls: true,
            readOnly: false,
            confirmWrites: false
        });
    });
});

describe('redis-cli args', () => {
    test('db adds -n, verify TLS drops --insecure', () => {
        const base = { host: 'h', port: 1 };
        expect(connArgs({ ...base, db: 4 })).toEqual(
            expect.arrayContaining(['-n', '4'])
        );
        expect(connArgs({ ...base, db: 0 })).not.toContain('-n');
        expect(connArgs({ ...base, tls: true, verifyTls: false })).toEqual(
            expect.arrayContaining(['--tls', '--insecure'])
        );
        const verified = connArgs({ ...base, tls: true, verifyTls: true });
        expect(verified).toContain('--tls');
        expect(verified).not.toContain('--insecure');
    });
});
