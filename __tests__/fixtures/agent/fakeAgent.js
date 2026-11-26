// Fake agent CLIs, one executable per command beside this file. FAKE_AGENT
// holds the script: { record: file, steps: [{ say } | { call: { name, args } }
// | { fail, stderr } | { hang: true }] }
// Each finds the MCP endpoint the way the real CLI would, and writes down what
// it was started with and what its calls got back.
const fs = require('fs');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
    StreamableHTTPClientTransport
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const argv = process.argv.slice(2);
const fileAt = (file) => ({
    text: fs.readFileSync(file, 'utf8'),
    mode: fs.statSync(file).mode & 0o777
});

// -> { server: { url, headers }, env, ...what else the CLI would read }
const CONFIGS = {
    claude() {
        const config = fileAt(argv[argv.indexOf('--mcp-config') + 1]);
        const { url, headers } = JSON.parse(config.text).mcpServers[
            'redis-deck'
        ];
        return {
            server: { url, headers },
            config,
            env: {
                attachmentsOff: process.env.CLAUDE_CODE_DISABLE_ATTACHMENTS,
                idleTimeout: process.env.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT
            }
        };
    },
    codex() {
        // -c <dotted key>=<TOML value>; a JSON string is a TOML string.
        const overrides = Object.fromEntries(
            argv
                .filter((_, i) => argv[i - 1] === '-c')
                .map((pair) => pair.split(/=(.*)/s).slice(0, 2))
        );
        const read = (key) => JSON.parse(overrides[key]);
        const token =
            process.env[read('mcp_servers.redis-deck.bearer_token_env_var')];
        return {
            server: {
                url: read('mcp_servers.redis-deck.url'),
                headers: { Authorization: `Bearer ${token}` }
            },
            overrides,
            env: {}
        };
    },
    gemini() {
        const settings = fileAt(path.resolve('.gemini/settings.json'));
        const { httpUrl, headers } = JSON.parse(settings.text).mcpServers[
            'redis-deck'
        ];
        const policyPath = argv[argv.indexOf('--admin-policy') + 1];
        return {
            server: { url: httpUrl, headers },
            settings,
            policy: fileAt(policyPath),
            policyPath,
            env: { trust: process.env.GEMINI_CLI_TRUST_WORKSPACE }
        };
    }
};

module.exports = function fakeAgent(command) {
    const script = JSON.parse(process.env.FAKE_AGENT);
    const record = {
        pid: process.pid,
        argv,
        cwd: process.cwd(),
        stdin: '',
        results: []
    };
    const save = () => fs.writeFileSync(script.record, JSON.stringify(record));

    async function main() {
        for await (const chunk of process.stdin) record.stdin += chunk;
        Object.assign(record, CONFIGS[command]());
        save();

        const client = new Client({ name: `${command}-fake`, version: '0' });
        await client.connect(
            new StreamableHTTPClientTransport(new URL(record.server.url), {
                requestInit: { headers: record.server.headers }
            })
        );
        record.tools = (await client.listTools()).tools.map((t) => t.name);
        save();

        for (const step of script.steps) {
            if (step.say) process.stdout.write(step.say);
            if (step.call) {
                const result = await client.callTool(
                    { name: step.call.name, arguments: step.call.args },
                    undefined,
                    { timeout: 60_000 }
                );
                record.results.push({
                    isError: Boolean(result.isError),
                    text: result.content[0].text
                });
                save();
            }
            if (step.fail) {
                process.stderr.write(step.stderr ?? '');
                process.exit(step.fail);
            }
            if (step.hang) {
                await new Promise(() => setInterval(() => {}, 1000));
            }
        }
        await client.close();
    }

    main().catch((error) => {
        process.stderr.write(`fake agent: ${error.message}`);
        process.exit(9);
    });
};
