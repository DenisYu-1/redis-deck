// How an AI client starts this app in --mcp mode. Packaged: the app
// executable. electron:dev: the dev Electron binary, which needs the repo path.
function mcpBinary({ packaged, execPath, appPath }) {
    return packaged
        ? { command: execPath, args: ['--mcp'] }
        : { command: execPath, args: [appPath, '--mcp'] };
}

module.exports = { mcpBinary };
