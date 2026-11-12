#!/usr/bin/env node
// Smoke check for a packaged Redis Deck build (any platform).
// Usage: node scripts/smoke-packaged.js <path to .app bundle | app executable>
//   macOS:   dist-electron/mac-arm64/"Redis Deck.app"
//   Linux:   dist-electron/linux-unpacked/redis-deck
//   Windows: dist-electron\win-unpacked\"Redis Deck.exe"
// Launches the app headless (--smoke: embedded server only, no window), with PATH
// stripped and REDIS_CLI_PATH unset so only the bundled redis-cli can work, then
// asserts GET /api/connections answers and the bundled `redis-cli --version` runs.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TIMEOUT_MS = 60000;

function resolveExecutable(target) {
    if (target.endsWith('.app')) {
        const macos = path.join(target, 'Contents', 'MacOS');
        return path.join(macos, fs.readdirSync(macos)[0]);
    }
    return target;
}

function appRoot(target) {
    return target.endsWith('.app') ? target : path.dirname(target);
}

function fail(msg) {
    console.error(`SMOKE FAIL: ${msg}`);
    process.exitCode = 1;
}

async function main() {
    const target = path.resolve(process.argv[2] || '');
    if (!process.argv[2] || !fs.existsSync(target)) {
        throw new Error(
            `usage: smoke-packaged.js <app path> (not found: ${process.argv[2]})`
        );
    }
    const exe = resolveExecutable(target);
    const userData = fs.mkdtempSync(
        path.join(os.tmpdir(), 'redis-deck-smoke-')
    );

    const env = { ...process.env };
    delete env.REDIS_CLI_PATH;
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_DEV;
    // Minimal PATH: system dirs only, so a PATH redis-cli can't mask a bundling bug.
    env.PATH =
        process.platform === 'win32'
            ? process.env.SystemRoot + '\\System32'
            : '/usr/bin:/bin';

    // The Chromium sandbox stays ON so a userns restriction shows up here as a
    // failure instead of being masked. Opt out explicitly with SMOKE_NO_SANDBOX=1.
    const args = ['--smoke', `--user-data-dir=${userData}`];
    if (process.env.SMOKE_NO_SANDBOX === '1') args.push('--no-sandbox');
    const child = spawn(exe, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let exited = false;
    let onExit = () => {};
    const exit = new Promise((resolve) => {
        child.on('exit', (code) => {
            exited = true;
            onExit(code);
            resolve();
        });
    });
    // Rejects if the app dies at any point, including after SMOKE_READY.
    const died = new Promise((_, reject) => {
        onExit = (code) =>
            reject(new Error(`app exited unexpectedly (${code})\n${output}`));
    });
    died.catch(() => {});
    let timer;
    const ready = new Promise((resolve, reject) => {
        timer = setTimeout(
            () => reject(new Error(`timeout waiting for app\n${output}`)),
            TIMEOUT_MS
        );
        const onData = (d) => {
            output += d;
            const m = output.match(/SMOKE_READY (\{.*\})/);
            if (m) {
                clearTimeout(timer);
                resolve(JSON.parse(m[1]));
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
    });

    try {
        const { port, redisCli } = await Promise.race([ready, died]);
        await Promise.race([checks(port, redisCli), died]);
    } finally {
        clearTimeout(timer);
        onExit = () => {};
        if (!exited) child.kill();
        await exit;
        fs.rmSync(userData, { recursive: true, force: true });
    }

    async function checks(port, redisCli) {
        const res = await fetch(`http://127.0.0.1:${port}/api/connections`);
        if (!res.ok) throw new Error(`GET /api/connections -> ${res.status}`);
        const body = await res.json();
        if (!Array.isArray(body) && typeof body !== 'object')
            throw new Error('unexpected /api/connections body');
        console.log(`ok  GET /api/connections -> ${res.status}`);

        const root = appRoot(target);
        if (
            !path.isAbsolute(redisCli) ||
            !path.resolve(redisCli).startsWith(root + path.sep)
        ) {
            throw new Error(
                `redis-cli is not the bundled one: ${redisCli} (expected inside ${root})`
            );
        }
        const version = execFileSync(redisCli, ['--version'], {
            env,
            encoding: 'utf8'
        }).trim();
        if (!/^redis-cli \d/.test(version))
            throw new Error(`unexpected redis-cli --version: ${version}`);
        console.log(`ok  bundled ${redisCli} -> ${version}`);
        console.log('SMOKE PASS');
    }
}

main().catch((err) => {
    fail(err.message);
});
