/** @jest-environment node */
const { execFileSync, spawnSync } = require('child_process');
const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrate } = require('../../services/migrate');
const migrations = require('../../services/migrations');

const ROOT = path.join(__dirname, '..', '..');
const DB_FILE = 'migrations.sqlite';
const childEnv = (dataDir, extra) => ({
    ...process.env,
    DATA_DIR: dataDir,
    REDIS_DECK_DB_FILE: DB_FILE,
    ...extra
});

// The database module migrates at load, so each start is a fresh node process.
function startApp(dataDir, script = '') {
    const out = execFileSync(
        process.execPath,
        [
            '-e',
            `const d = require('./services/database');
            ${script}
            const raw = d.getDatabase();
            console.log(JSON.stringify({
                version: raw.pragma('user_version', { simple: true }),
                tables: raw.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name),
                connections: d.getAllConnections().map((c) => c.id)
            }));`
        ],
        {
            cwd: ROOT,
            env: childEnv(dataDir),
            encoding: 'utf8',
            stdio: 'pipe'
        }
    );
    return JSON.parse(out.trim().split('\n').pop());
}

const backups = (dir) => fs.readdirSync(dir).filter((f) => f.includes('.bak'));

describe('database migrations', () => {
    let dataDir;
    beforeEach(() => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redis-deck-mig-'));
    });
    afterEach(() => {
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    test('a fresh data folder starts at data version 6 with today’s tables and no backup', () => {
        const state = startApp(dataDir);

        expect(state.version).toBe(6);
        expect(state.tables).toEqual([
            'ai_access',
            'ai_activity',
            'ai_model',
            'connections',
            'idx_ai_activity_connection',
            'idx_ai_activity_time',
            'idx_stats_connection_time',
            'idx_workflow_runs_action',
            'saved_searches',
            'settings',
            'stats_snapshots',
            'workflow_runs'
        ]);
        expect(backups(dataDir)).toEqual([]);
    });

    test('restarting on an up-to-date file keeps its data and makes no backup', () => {
        const first = startApp(
            dataDir,
            "d.createConnection({ id: 'test:kept', host: 'h', port: 1, password: 'secret' });"
        );
        const second = startApp(dataDir);

        expect(second).toEqual(first);
        expect(second.version).toBe(6);
        expect(second.connections).toEqual(['test:kept']);
        expect(backups(dataDir)).toEqual([]);
    });

    describe('a database newer than the app', () => {
        let file;
        beforeEach(() => {
            file = path.join(dataDir, DB_FILE);
            const raw = new Database(file);
            raw.exec('CREATE TABLE future (x)');
            raw.pragma('user_version = 999');
            raw.close();
        });

        test('is refused with an "update the app" error and left untouched', () => {
            const before = fs.readFileSync(file);

            expect(() => startApp(dataDir)).toThrow(
                /data version 999.*update the app/is
            );
            expect(fs.readFileSync(file).equals(before)).toBe(true);
            expect(fs.readdirSync(dataDir)).toEqual([DB_FILE]);
        });

        test('makes the Node server log the error and exit non-zero', () => {
            const result = spawnSync(process.execPath, ['server.js'], {
                cwd: ROOT,
                env: childEnv(dataDir, { PORT: '0' }),
                encoding: 'utf8',
                timeout: 10000
            });

            expect(result.status).not.toBe(0);
            expect(result.status).not.toBeNull();
            expect(result.stderr).toMatch(/update the app/i);
        });
    });
    test('data version 4 turns done / failed activity rows into ok / error and keeps the rest', () => {
        const raw = new Database(path.join(dataDir, DB_FILE));
        migrate(raw, migrations.slice(0, 3));
        const ins = raw.prepare(
            "INSERT INTO ai_activity (created_at, client, connection_id, operation, result, error) VALUES (?, 'c', 'k', 'set_key', ?, ?)"
        );
        ins.run(1, 'done', null);
        ins.run(2, 'failed', 'boom');
        ins.run(3, 'denied', 'no');
        ins.run(4, 'blocked', 'ro');

        migrate(raw, migrations);

        const rows = raw
            .prepare(
                'SELECT result, error, args, response, duration_ms AS d FROM ai_activity ORDER BY created_at'
            )
            .all();
        raw.close();
        const empty = { args: null, response: null, d: null };
        expect(rows).toEqual([
            { result: 'ok', error: null, ...empty },
            { result: 'error', error: 'boom', ...empty },
            { result: 'denied', error: 'no', ...empty },
            { result: 'blocked', error: 'ro', ...empty }
        ]);
    });

    describe('an older versioned database', () => {
        let file;
        // Previous-version fixture: the current list is the "earlier" release.
        const V = migrations.length;
        const BAK = `.bak-v${V}`;
        beforeEach(() => {
            file = path.join(dataDir, DB_FILE);
            const raw = new Database(file);
            migrate(raw, migrations);
            raw.prepare(
                "INSERT INTO connections (id, host, port, password) VALUES ('test:kept', 'h', 1, 'secret')"
            ).run();
            raw.close();
        });

        const openAndMigrate = (list) => {
            const raw = new Database(file);
            try {
                migrate(raw, list);
            } finally {
                raw.close();
            }
        };
        const read = (f) => {
            const raw = new Database(f, { readonly: true });
            const state = {
                version: raw.pragma('user_version', { simple: true }),
                connections: raw
                    .prepare('SELECT id, password FROM connections')
                    .all(),
                tables: raw
                    .prepare(
                        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
                    )
                    .all()
                    .map((r) => r.name)
            };
            raw.close();
            return state;
        };

        test('is backed up as .bak-v<current>, upgraded, and keeps its Connections', () => {
            fs.writeFileSync(`${file}${BAK}`, 'stale backup');

            openAndMigrate([
                ...migrations,
                (db) => db.exec('CREATE TABLE extra (x)')
            ]);

            const after = read(file);
            const backup = read(`${file}${BAK}`);
            expect(after.version).toBe(V + 1);
            expect(after.connections).toEqual([
                { id: 'test:kept', password: 'secret' }
            ]);
            expect(after.tables).toContain('extra');
            expect(backups(dataDir)).toEqual([`${DB_FILE}${BAK}`]);
            expect(backup.version).toBe(V);
            expect(backup.tables).not.toContain('extra');
        });

        test('a failing migration rolls back, stays at the current version, and names the backup', () => {
            const failing = (db) => {
                db.exec('CREATE TABLE half_done (x)');
                throw new Error('boom');
            };

            expect(() => openAndMigrate([...migrations, failing])).toThrow(
                `${file}${BAK}`
            );
            const after = read(file);
            expect(after.version).toBe(V);
            expect(after.tables).not.toContain('half_done');
            expect(after.connections).toEqual([
                { id: 'test:kept', password: 'secret' }
            ]);
            expect(backups(dataDir)).toEqual([`${DB_FILE}${BAK}`]);
        });
    });

    test('an unversioned legacy file with tables is refused, untouched, with a .bak-v0 backup', () => {
        const file = path.join(dataDir, DB_FILE);
        const raw = new Database(file);
        raw.exec(
            'CREATE TABLE connections (id TEXT PRIMARY KEY, host TEXT, port INTEGER)'
        );
        raw.prepare(
            "INSERT INTO connections VALUES ('test:legacy', 'h', 1)"
        ).run();
        raw.close();
        const before = fs.readFileSync(file);

        expect(() => startApp(dataDir)).toThrow(/\.bak-v0/);
        expect(fs.readFileSync(file).equals(before)).toBe(true);
        expect(backups(dataDir)).toEqual([`${DB_FILE}.bak-v0`]);
    });
});
