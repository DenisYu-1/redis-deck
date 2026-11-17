// Electron main process: starts the embedded Express server on a random
// 127.0.0.1 port, keeps Connections in the per-user app data folder and opens
// the UI in a window. Dev mode (ELECTRON_DEV=1) serves the client through an
// in-process Vite dev server for hot reload, proxying /api to the embedded server.
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { applyBundledRedisCli } = require('./redisCli');
const { isSafeExternalUrl, isSameOrigin } = require('./navGuard');

const ROOT = path.join(__dirname, '..');
const isDev = process.env.ELECTRON_DEV === '1';
// --smoke: headless check for packaged builds (see scripts/smoke-packaged.js).
const isSmoke = process.argv.includes('--smoke');
// --mcp: run as an AI client's stdio MCP server (see startMcp).
const isMcp = process.argv.includes('--mcp');

let server;
let viteServer;
let mainWindow;

// Resolves with null when redis-cli runs, else the spawn error.
function checkRedisCli() {
    const bin = process.env.REDIS_CLI_PATH || 'redis-cli';
    return new Promise((resolve) => {
        execFile(bin, ['--version'], (err) => resolve(err || null));
    });
}

async function startVite(apiPort) {
    const { createServer } = await import('vite');
    viteServer = await createServer({
        root: ROOT,
        server: {
            host: '127.0.0.1',
            proxy: {
                '/api': {
                    target: `http://127.0.0.1:${apiPort}`,
                    changeOrigin: true
                }
            }
        }
    });
    await viteServer.listen();
    return viteServer.resolvedUrls.local[0];
}

// Same data folder and redis-cli for the window app and --mcp.
function applyAppEnv() {
    process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');
    applyBundledRedisCli({
        packaged: app.isPackaged,
        resourcesPath: process.resourcesPath
    });
}

// --mcp: stdio MCP server for an AI client. No window, no HTTP listener, no
// single-instance lock, so it runs beside the normal app. Errors go to
// stderr only: stdout belongs to the protocol.
function startMcp() {
    app.dock?.hide();
    app.whenReady()
        .then(() => {
            applyAppEnv();
            const { startStdio } = require('../services/mcp/stdio');
            return startStdio({}, { onClose: () => app.quit() });
        })
        .catch((err) => {
            console.error('Redis Deck MCP failed to start:', err);
            app.exit(1);
        });
}

async function boot() {
    applyAppEnv();

    const cliError = await checkRedisCli();
    if (cliError && !isSmoke) {
        if (cliError.code === 'ENOENT') {
            dialog.showErrorBox(
                'redis-cli not found',
                'Redis Deck needs redis-cli. Install it (e.g. brew install redis) or set REDIS_CLI_PATH to its location, then restart.'
            );
        } else {
            dialog.showErrorBox(
                'redis-cli failed to run',
                `redis-cli was found but could not be executed (${cliError.code || cliError.message}). Check its permissions and architecture, or set REDIS_CLI_PATH to a working binary.`
            );
        }
    }

    // Required after DATA_DIR is set: services/database reads it at load time.
    const { startServer } = require('../server');
    server = await startServer({
        port: 0,
        host: '127.0.0.1',
        embedded: true
    });
    const apiPort = server.address().port;

    if (isSmoke) {
        console.log(
            `SMOKE_READY ${JSON.stringify({
                port: apiPort,
                redisCli: process.env.REDIS_CLI_PATH || 'redis-cli'
            })}`
        );
        return;
    }

    const url = isDev
        ? await startVite(apiPort)
        : `http://127.0.0.1:${apiPort}`;

    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, 'icon.png'),
        // Custom title bar: content extends under native window buttons.
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0d0e10',
            symbolColor: '#e6e6e6',
            height: 36
        },
        trafficLightPosition: { x: 14, y: 11 },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow = win;
    // Renderer pushes theme colors; the overlay only exists on Win/Linux.
    ipcMain.on('titlebar-colors', (e, color, symbolColor) => {
        if (process.platform === 'darwin' || win.isDestroyed()) return;
        if (typeof color !== 'string' || typeof symbolColor !== 'string')
            return;
        win.setTitleBarOverlay({ color, symbolColor, height: 36 });
    });
    win.webContents.setWindowOpenHandler(({ url: target }) => {
        if (isSafeExternalUrl(target)) shell.openExternal(target);
        return { action: 'deny' };
    });
    // The window must never leave the local app origin (server or Vite dev).
    win.webContents.on('will-navigate', (event, target) => {
        if (!isSameOrigin(target, url)) {
            event.preventDefault();
            if (isSafeExternalUrl(target)) shell.openExternal(target);
        }
    });
    await win.loadURL(url);
}

if (isMcp) {
    startMcp();
} else if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });
    start();
}

function start() {
    app.whenReady().then(() => {
        if (process.platform === 'darwin') {
            app.dock?.setIcon(path.join(__dirname, 'icon.png'));
        }
        return boot().catch((err) => {
            dialog.showErrorBox('Redis Deck failed to start', String(err));
            app.quit();
        });
    });
}

app.on('window-all-closed', () => app.quit());

app.on('will-quit', () => {
    server?.close();
    viteServer?.close();
});
