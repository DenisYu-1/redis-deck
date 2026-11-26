// Runs assistant turns on the fake agent CLIs (see fixtures/agent).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runTurn } = require('../../services/ai/turnRunner');

const FIXTURES = path.join(__dirname, '../fixtures/agent');

// -> { turn(steps, options), record(), dir, remove() }. One per test.
function createFakeAgent() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-fake-agent-'));
    const recordFile = path.join(dir, 'record.json');

    return {
        dir,
        // What the agent was started with, and what its calls got back.
        record: () => JSON.parse(fs.readFileSync(recordFile, 'utf8')),
        // One turn of `agent` playing `steps` -> every event, in order.
        // onEvent sees each event as it comes.
        async turn(
            agent,
            steps,
            { onEvent = () => {}, model, ...request } = {}
        ) {
            process.env.FAKE_AGENT = JSON.stringify({
                record: recordFile,
                steps
            });
            const events = [];
            await runTurn({
                chatId: 'chat-agent',
                connectionId: global.TEST_CONNECTION_ID,
                messages: [{ role: 'user', text: 'hello' }],
                model: {
                    agent,
                    path: path.join(FIXTURES, agent),
                    args: '',
                    ...model
                },
                emit: (event) => {
                    events.push(event);
                    onEvent(event);
                },
                ...request
            });
            return events;
        },
        remove() {
            delete process.env.FAKE_AGENT;
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
}

module.exports = { createFakeAgent };
