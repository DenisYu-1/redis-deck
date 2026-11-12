// Electron main process: starts the embedded Express server on a random
// 127.0.0.1 port, keeps Connections in the per-user app data folder and opens
// the UI in a window. Dev mode (ELECTRON_DEV=1) serves the client through an
// in-process Vite dev server for hot reload, proxying /api to the embedded server.
const { app, BrowserWindow, dialog, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const isDev = process.env.ELECTRON_DEV === '1';

let server;
let viteServer;

function checkRedisCli() {
    const bin = process.env.REDIS_CLI_PATH || 'redis-cli';
    return new Promise((resolve) => {
        execFile(bin, ['--version'], (err) => resolve(!err));
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

async function boot() {
    process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');

    if (!(await checkRedisCli())) {
        dialog.showErrorBox(
            'redis-cli not found',
            'Redis Deck needs redis-cli. Install it (e.g. brew install redis) or set REDIS_CLI_PATH to its location, then restart.'
        );
    }

    // Required after DATA_DIR is set: services/database reads it at load time.
    const { startServer } = require('../server');
    server = await startServer({ port: 0, host: '127.0.0.1' });
    const apiPort = server.address().port;

    const url = isDev
        ? await startVite(apiPort)
        : `http://127.0.0.1:${apiPort}`;

    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    win.webContents.setWindowOpenHandler(({ url: target }) => {
        shell.openExternal(target);
        return { action: 'deny' };
    });
    await win.loadURL(url);
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        app.dock?.setIcon(path.join(__dirname, 'icon.png'));
    }
    return boot().catch((err) => {
        dialog.showErrorBox('Redis Deck failed to start', String(err));
        app.quit();
    });
});

app.on('window-all-closed', () => app.quit());

app.on('will-quit', () => {
    server?.close();
    viteServer?.close();
});
