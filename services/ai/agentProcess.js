// One run of an agent CLI: its endpoint, a fresh folder with the MCP config (so
// no project files reach the agent) and the process. All three are gone when it
// returns, however the run ends.
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { splitArgs } = require('./agents');
const { findAgent, searchPath } = require('./agentLookup');
const { openAgentEndpoint } = require('./agentEndpoint');

const KILL_AFTER_MS = 2000;
// Of stdout and stderr, kept for error messages and the Test.
const KEPT_CHARS = 20_000;

const keep = (kept, chunk) => (kept + chunk).slice(-KEPT_CHARS);

// Resolves once the process is gone. Aborting signal ends it.
function waitFor(child, { signal, onText }) {
    let stdout = '';
    let stderr = '';
    let killTimer;
    const kill = () => {
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
    };
    if (signal?.aborted) kill();
    else signal?.addEventListener('abort', kill, { once: true });

    child.stdout.setEncoding('utf8').on('data', (chunk) => {
        stdout = keep(stdout, chunk);
        onText(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
        stderr = keep(stderr, chunk);
    });
    // A process the agent started may hold the pipes open after it.
    child.on('exit', () => {
        setTimeout(() => {
            child.stdout.destroy();
            child.stderr.destroy();
        }, KILL_AFTER_MS).unref();
    });

    return new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code, killedBy) => {
            clearTimeout(killTimer);
            signal?.removeEventListener('abort', kill);
            resolve({ code, killedBy, stdout, stderr: stderr.trim() });
        });
    });
}

// agent: an entry of agents.js. path, args: the user's fields ('' = default).
// server: the McpServer the agent's tool calls run on. onText gets stdout as it
// comes. -> { code, killedBy, stdout, stderr, token }
async function runAgent({
    agent,
    path: own,
    args,
    server,
    system,
    prompt,
    onText = () => {},
    signal
}) {
    const binary = findAgent(agent.command, { path: own });
    if (!binary) {
        throw new Error(
            `${agent.name} (${agent.command}) was not found. Install it where Redis Deck runs, or set its path in the AI assistant settings.`
        );
    }
    const endpoint = await openAgentEndpoint(server);
    let dir;
    try {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'redis-deck-agent-'));
        const turn = agent.prepare({
            url: endpoint.url,
            token: endpoint.token,
            system,
            prompt
        });
        const configPath = path.join(dir, 'mcp.json');
        await fs.writeFile(configPath, turn.mcpConfig ?? '', { mode: 0o600 });
        const argv = splitArgs(args || agent.defaultArgs).map((word) =>
            word.replaceAll('{mcp_config}', configPath)
        );
        const child = spawn(binary, [...argv, ...turn.args], {
            cwd: dir,
            // The CLI may be a script that needs node from these folders.
            env: {
                ...process.env,
                ...turn.env,
                PATH: [path.dirname(binary), ...searchPath()].join(
                    path.delimiter
                )
            }
        });
        // An agent that exits without reading its prompt is not an error here.
        child.stdin.on('error', () => {});
        child.stdin.end(turn.stdin);
        const result = await waitFor(child, { signal, onText });
        return { ...result, token: endpoint.token };
    } finally {
        await endpoint.close();
        if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
}

// Why a run that nothing stopped did not end well, or null.
function failureOf({ name }, { code, killedBy, stderr }) {
    if (code === 0) return null;
    const how = killedBy
        ? `was stopped (${killedBy})`
        : `exited with code ${code}`;
    return `${name} ${how}${stderr ? `: ${stderr.slice(-500)}` : '.'}`;
}

module.exports = { runAgent, failureOf };
