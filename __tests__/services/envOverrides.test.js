/** @jest-environment node */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Env overrides are read at module load, so each case runs in a fresh node process.
function runNode(script, env = {}) {
    const childEnv = { ...process.env, ...env };
    for (const k of Object.keys(env)) {
        if (env[k] === undefined) delete childEnv[k];
    }
    return execFileSync(process.execPath, ['-e', script], {
        cwd: ROOT,
        env: childEnv,
        encoding: 'utf8'
    });
}

describe('backend env overrides', () => {
    let tmp;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redis-deck-env-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    describe('DATA_DIR', () => {
        const script = `
            const d = require('./services/database');
            d.createConnection({ id: 'env-test', host: 'h', port: 1 });
            console.log(d.getConnection('env-test').id);
        `;

        test('creates and reads the Connections database in DATA_DIR', () => {
            const dataDir = path.join(tmp, 'nested', 'data');
            const out = runNode(script, {
                DATA_DIR: dataDir,
                REDIS_DECK_DB_FILE: 'env.sqlite'
            });
            expect(out.trim()).toBe('env-test');
            expect(fs.existsSync(path.join(dataDir, 'env.sqlite'))).toBe(true);
        });
    });

    describe('REDIS_CLI_PATH', () => {
        const script = `
            require('./services/redis')
                .execRedisCommandWithConfig('PING', {
                    host: '127.0.0.1',
                    port: 6379
                })
                .then((r) => console.log(String(r).trim()));
        `;

        test('runs Redis commands through the given binary', () => {
            const log = path.join(tmp, 'called.log');
            const wrapper = path.join(tmp, 'fake-redis-cli');
            fs.writeFileSync(
                wrapper,
                `#!/bin/sh\necho called >> "${log}"\nexec redis-cli "$@"\n`,
                { mode: 0o755 }
            );
            const out = runNode(script, { REDIS_CLI_PATH: wrapper });
            expect(out).toContain('PONG');
            expect(fs.readFileSync(log, 'utf8')).toContain('called');
        });

        test('defaults to redis-cli from PATH when unset', () => {
            const out = runNode(script, { REDIS_CLI_PATH: undefined });
            expect(out).toContain('PONG');
        });

        test('reports a readable error when the binary is missing', () => {
            const out = runNode(
                `require('./services/redis')
                    .execRedisCommandWithConfig('PING', { host: '127.0.0.1', port: 6379 })
                    .catch((e) => console.log(e.message));`,
                { REDIS_CLI_PATH: path.join(tmp, 'nope-redis-cli') }
            );
            expect(out).toMatch(/redis-cli not found/);
            expect(out).toContain('REDIS_CLI_PATH');
        });
    });
});
