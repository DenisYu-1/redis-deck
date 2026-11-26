// The Test of a Local agent: one real turn asking it to list its redis-deck
// tools. It counts the registry's tool names in the answer, so it proves the
// model sees them, whatever the CLI prints around them.
const { listToolSwitches } = require('../mcp/toolSwitches');
const { agentById } = require('./agents');
const { findAgent } = require('./agentLookup');
const { runAgent, failureOf } = require('./agentProcess');
const { createListingServer } = require('./assistantServer');

const TIMEOUT_MS = 2 * 60 * 1000;
const SYSTEM = 'You are checking the setup of the Redis Deck AI assistant.';
// Codex shows MCP tools only once it has looked them up, so the prompt must not
// forbid every tool.
const PROMPT =
    'List the names of your redis-deck tools, one per line, and nothing else. If your tool list does not show them, look them up. Do not call any redis-deck tool.';

const toolsNamedIn = (answer) =>
    listToolSwitches().filter(
        ({ name, enabled }) =>
            enabled &&
            new RegExp(`(?<![a-z])${name}(?![a-z_])`, 'i').test(answer)
    ).length;

const failed = (title, detail) => ({ ok: false, title, detail });

// choice: { agent, agentPath, agentArgs } (agentSettings.parseAgent).
// -> { ok, title, detail }
async function testAgent({ agent: id, agentPath, agentArgs }) {
    const agent = agentById(id);
    if (!findAgent(agent.command, { path: agentPath })) {
        return failed(
            `${agent.command} not found`,
            'Install it where Redis Deck runs, or set its path.'
        );
    }
    const started = Date.now();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let result;
    try {
        result = await runAgent({
            agent,
            path: agentPath,
            args: agentArgs,
            server: createListingServer(),
            system: SYSTEM,
            prompt: PROMPT,
            signal: timeout
        });
    } catch (error) {
        return failed(`${agent.name} did not start`, error.message);
    }
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    const said = result.stdout.trim().slice(0, 500);
    const failure = timeout.aborted
        ? `No answer in ${TIMEOUT_MS / 1000} s.`
        : failureOf(agent, result);
    if (failure) {
        const detail = `${failure} ${said}`.trim();
        return failed(
            `${agent.name} did not answer`,
            detail.replaceAll(result.token, '●●●')
        );
    }
    const count = toolsNamedIn(result.stdout);
    if (count === 0) {
        return failed(
            `${agent.name} listed no tools`,
            said.replaceAll(result.token, '●●●') || 'It printed nothing.'
        );
    }
    return {
        ok: true,
        title: `${agent.name} answered in ${seconds} s`,
        detail: `It listed ${count} Redis Deck MCP tools.`
    };
}

module.exports = { testAgent };
