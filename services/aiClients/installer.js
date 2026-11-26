// Client config installer: writes the `redis-deck` MCP server entry into AI
// client config files under `home`. Never shells out to a client's CLI (apps
// started from Finder have no shell PATH). `command` + `args` start this
// binary in --mcp mode; an entry with different ones is Stale.
const fs = require('fs');
const os = require('os');
const path = require('path');
const CLIENTS = require('./clients');
const { InstallerError } = require('./errors');

const SERVER_NAME = 'redis-deck';

function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
    }
}

// Temp file + rename so a crash never leaves a half-written config.
// Keeps the existing file's permissions (~/.claude.json is often 0600).
function writeText(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const mode = fs.existsSync(file) ? fs.statSync(file).mode : 0o600;
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, text, { mode });
    fs.renameSync(tmp, file);
}

const sameArgs = (a, b) =>
    Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

function createInstaller({
    home = os.homedir(),
    command,
    args = [],
    clients = CLIENTS
}) {
    const binary = { command, args };

    function client(id) {
        const found = clients.find((c) => c.id === id);
        if (!found) throw new InstallerError(`Unknown AI client '${id}'`, 404);
        return { ...found, file: found.configPath(home) };
    }

    function status(id) {
        const c = client(id);
        const entry = c.format.read(readText(c.file), SERVER_NAME, c.file);
        if (!entry) {
            const found = c.detect(home).some((p) => fs.existsSync(p));
            return found ? 'not-installed' : 'not-found';
        }
        return entry.command === command && sameArgs(entry.args, args)
            ? 'installed'
            : 'stale';
    }

    function install(id) {
        const c = client(id);
        if (status(id) === 'not-found') {
            throw new InstallerError(
                `${c.name} not found on this computer`,
                409
            );
        }
        const text = readText(c.file);
        writeText(
            c.file,
            c.format.write(text, SERVER_NAME, c.entry(binary), c.file)
        );
    }

    function remove(id) {
        const c = client(id);
        const text = readText(c.file);
        if (text === null) return;
        const next = c.format.remove(text, SERVER_NAME, c.file);
        if (next !== text) writeText(c.file, next);
    }

    function snippet(id) {
        const c = client(id);
        return {
            path: c.file,
            text: c.format.snippet(SERVER_NAME, c.entry(binary))
        };
    }

    // One row per AI client; a broken config file shows as an error row.
    function list() {
        return clients.map(({ id, name }) => {
            const row = { id, name, configPath: client(id).file };
            try {
                return { ...row, status: status(id) };
            } catch (err) {
                return { ...row, status: 'error', error: err.message };
            }
        });
    }

    // The stdio command line the installer writes into client configs.
    const commandLine = () => [command, ...args].join(' ');

    return { list, status, install, remove, snippet, commandLine };
}

module.exports = { createInstaller, SERVER_NAME };
