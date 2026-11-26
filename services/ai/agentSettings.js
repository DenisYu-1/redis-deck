// The Local agent part of the model settings, as stored in the ai_model row
// (see migration 007). services/aiModel.js reads and writes the row.
const path = require('path');
const { AGENTS, agentById } = require('./agents');
const { findAgent } = require('./agentLookup');

const stored = (row) => JSON.parse(row.agents || '{}');

const fieldsOf = (row, id) => ({ path: '', args: '', ...stored(row)[id] });

const found = (agent, own) => findAgent(agent.command, { path: own });

// For the browser: every agent, with where its CLI is (null: missing).
const listAgents = (row) =>
    AGENTS.map((agent) => {
        const { path: own, args } = fieldsOf(row, agent.id);
        const { id, name, command, defaultArgs } = agent;
        return {
            id,
            name,
            command,
            defaultArgs,
            path: own,
            args: args || defaultArgs,
            found: found(agent, own)
        };
    });

// What a turn runs on (see agentTurn.js).
const agentModelOf = (row) => ({
    agent: row.agent,
    ...fieldsOf(row, row.agent)
});

const agentReady = (row) =>
    found(agentById(row.agent), fieldsOf(row, row.agent).path) !== null;

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

// Validates a request body of mode 'agent'.
function parseAgent({ agent: id, agentPath, agentArgs }) {
    const agent = agentById(id);
    if (!agent) throw new Error('Unknown agent');
    const own = trimmed(agentPath);
    // The web UI has no login: this field must not start any other program.
    if (
        own &&
        !(path.isAbsolute(own) && path.basename(own) === agent.command)
    ) {
        throw new Error(
            `The path must be the full path of a "${agent.command}" binary`
        );
    }
    const args = trimmed(agentArgs);
    return {
        mode: 'agent',
        agent: id,
        agentPath: own,
        agentArgs: args === agent.defaultArgs ? '' : args
    };
}

// The columns a choice writes; the other agents' fields stay as they are.
const agentColumns = (row, { agent, agentPath, agentArgs }) => ({
    mode: 'agent',
    agent,
    agents: JSON.stringify({
        ...stored(row),
        [agent]: { path: agentPath, args: agentArgs }
    })
});

module.exports = {
    agentColumns,
    agentModelOf,
    agentReady,
    listAgents,
    parseAgent
};
