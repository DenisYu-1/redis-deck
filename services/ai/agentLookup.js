// Where an agent CLI is: PATH plus the usual install folders, because an app
// started from Finder does not get the shell's PATH.
const fs = require('fs');
const os = require('os');
const path = require('path');

const SYSTEM_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

function searchPath({
    home = os.homedir(),
    env = process.env,
    systemDirs = SYSTEM_DIRS
} = {}) {
    return [
        ...(env.PATH ?? '').split(path.delimiter).filter(Boolean),
        path.join(home, '.local', 'bin'),
        ...systemDirs,
        path.join(home, '.npm-global', 'bin')
    ];
}

function isExecutable(file) {
    try {
        fs.accessSync(file, fs.constants.X_OK);
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

// -> the binary's path, or null. options.path (the path field) replaces the
// search; it must be named like the command, so that the field (the web UI has
// no login) cannot start any other program.
function findAgent(command, { path: own, ...options } = {}) {
    if (own) {
        const named = path.isAbsolute(own) && path.basename(own) === command;
        return named && isExecutable(own) ? own : null;
    }
    const candidates = searchPath(options).map((dir) =>
        path.join(dir, command)
    );
    return candidates.find(isExecutable) ?? null;
}

module.exports = { findAgent, searchPath };
