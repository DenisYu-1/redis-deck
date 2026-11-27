// Model settings of the AI assistant. The API key leaves the server only towards
// the provider and Base URL it was entered for: callers get its last four
// characters, and error texts are scrubbed of it.
const { getDatabase } = require('./database');
const anthropic = require('./ai/anthropic');
const adapters = require('./ai/adapters');
const { listModels } = require('./ai/openai');
const { causeOf } = require('./ai/providerHttp');
const { apiRoot, serverUrl } = require('./ai/serverUrl');
const {
    agentColumns,
    agentModelOf,
    agentReady,
    listAgents,
    parseAgent
} = require('./ai/agentSettings');
const { testAgent } = require('./ai/agentTest');
const { maskSecret, trimmed } = require('./ai/text');

const PROVIDERS = ['anthropic', 'openai', 'openai-compatible'];
const DEFAULTS = Object.freeze({
    mode: 'api',
    provider: 'anthropic',
    model: anthropic.DEFAULT_MODEL,
    api_key: '',
    base_url: '',
    local_url: '',
    local_model: '',
    agent: 'claude',
    agents: '{}'
});
// A shorter key would be mostly given away by its last four characters.
const MIN_HINTED_LENGTH = 12;

const readRow = () =>
    getDatabase().prepare('SELECT * FROM ai_model WHERE id = 1').get() ??
    DEFAULTS;

const lastFour = (key) => {
    if (!key) return null;
    return key.length < MIN_HINTED_LENGTH ? '' : key.slice(-4);
};

// What a turn runs on; null while the chosen mode is not set up. A Local agent
// whose CLI is gone is returned all the same: its turn says so.
const chatModelOf = (row) => MODES[row.mode].chatModel(row);

function getModelSettings() {
    const row = readRow();
    return {
        mode: row.mode,
        provider: row.provider,
        model: row.model,
        baseUrl: row.base_url,
        localUrl: row.local_url,
        localModel: row.local_model,
        models: anthropic.MODELS,
        defaultModel: anthropic.DEFAULT_MODEL,
        keyLast4: lastFour(row.api_key),
        agent: row.agent,
        agents: listAgents(row),
        ready: MODES[row.mode].ready(row)
    };
}

// Server-side only: it carries the key.
const getChatModel = () => chatModelOf(readRow());

// The key for this provider and Base URL: the typed one, else the stored one if
// it was entered for exactly these. Error messages must never include it.
function keyFor(provider, baseUrl, apiKey = '') {
    if (typeof apiKey !== 'string') throw new Error('apiKey must be text');
    const typed = apiKey.trim();
    // fetch refuses anything else as a header value, in an error quoting it.
    if (!/^[\x21-\x7e]*$/.test(typed)) {
        throw new Error('The API key contains characters a key cannot have');
    }
    if (typed) return typed;
    const row = readRow();
    const same = row.provider === provider && row.base_url === baseUrl;
    return same ? row.api_key : '';
}

// Validates a request body of mode 'api'.
function parseApiKey({ provider, model, baseUrl, apiKey }) {
    if (!PROVIDERS.includes(provider)) throw new Error('Unknown provider');
    const id = trimmed(model);
    if (provider === 'anthropic' && !anthropic.MODELS.includes(id)) {
        throw new Error('Unknown model');
    }
    if (!id) throw new Error('Enter a model id');
    const url =
        provider === 'openai-compatible' ? serverUrl(baseUrl, 'Base URL') : '';
    return {
        mode: 'api',
        provider,
        model: id,
        baseUrl: url,
        apiKey: keyFor(provider, url, apiKey)
    };
}

const parseLocal = ({ localUrl, localModel }) => ({
    mode: 'local',
    localUrl: serverUrl(localUrl, 'server URL'),
    localModel: trimmed(localModel)
});

// Validates a request body.
function parse(body = {}) {
    if (!Object.hasOwn(MODES, body.mode)) throw new Error('Unknown mode');
    return MODES[body.mode].parse(body);
}

function saveModelSettings(body) {
    const choice = parse(body);
    // The columns of the chosen mode; the other modes' settings stay.
    const columns = MODES[choice.mode].columns(choice);
    const row = { ...readRow(), ...columns, id: 1 };
    getDatabase()
        .prepare(
            `INSERT OR REPLACE INTO ai_model
                 (id, mode, provider, model, api_key, base_url, local_url,
                  local_model, agent, agents)
             VALUES (@id, @mode, @provider, @model, @api_key, @base_url,
                 @local_url, @local_model, @agent, @agents)`
        )
        .run(row);
    return getModelSettings();
}

const failed = (title, detail) => ({ ok: false, title, detail });

const listLocalModels = async (localUrl) =>
    listModels(apiRoot(serverUrl(localUrl, 'server URL')));

async function testLocal({ localUrl }) {
    const started = Date.now();
    try {
        const models = await listModels(apiRoot(localUrl));
        if (models.length === 0) {
            return failed('No models', 'The server lists no models.');
        }
        const plural = models.length === 1 ? 'model' : 'models';
        return {
            ok: true,
            title: `${adapters.local.LABEL} answered in ${Date.now() - started} ms`,
            detail: `It lists ${models.length} ${plural}.`,
            models
        };
    } catch (error) {
        return failed('Could not list the models', causeOf(error));
    }
}

async function testApiKey({ provider, model, baseUrl, apiKey }) {
    if (!apiKey) {
        return failed('No API key', 'Paste a key, then test again.');
    }
    const { LABEL, ping } = adapters[provider];
    const scrub = (text) => maskSecret(text, apiKey);
    const started = Date.now();
    try {
        const result = await ping({ apiKey, model, baseUrl });
        if (!result.ok) {
            return failed(
                `${LABEL} returned ${result.status}`,
                scrub(result.error)
            );
        }
        return {
            ok: true,
            title: `${LABEL} replied in ${Date.now() - started} ms`,
            detail: `Model ${model} with tool use.`
        };
    } catch (error) {
        return failed(`Could not reach ${LABEL}`, scrub(causeOf(error)));
    }
}

// One call with the typed (or stored) settings; saves nothing. Resolves to
// { ok, title, detail, models? }; throws only for invalid input.
async function testModelSettings(body) {
    const choice = parse(body);
    return MODES[choice.mode].test(choice);
}

// Everything that differs by mode. parse validates a request body into a
// choice; columns are what saving that choice writes.
const MODES = {
    api: {
        chatModel: (row) =>
            row.api_key
                ? {
                      adapter: adapters[row.provider],
                      model: row.model,
                      apiKey: row.api_key,
                      baseUrl: row.base_url
                  }
                : null,
        ready: (row) => Boolean(row.api_key),
        parse: parseApiKey,
        columns: ({ provider, model, baseUrl, apiKey }) => ({
            mode: 'api',
            provider,
            model,
            base_url: baseUrl,
            api_key: apiKey
        }),
        test: testApiKey
    },
    agent: {
        chatModel: agentModelOf,
        ready: agentReady,
        parse: parseAgent,
        columns: (choice) => agentColumns(readRow(), choice),
        test: testAgent
    },
    local: {
        chatModel: (row) =>
            row.local_url && row.local_model
                ? {
                      adapter: adapters.local,
                      model: row.local_model,
                      apiKey: '',
                      baseUrl: apiRoot(row.local_url)
                  }
                : null,
        ready: (row) => Boolean(row.local_url && row.local_model),
        parse: parseLocal,
        columns: ({ localUrl, localModel }) => {
            if (!localModel) throw new Error('Pick a model');
            return {
                mode: 'local',
                local_url: localUrl,
                local_model: localModel
            };
        },
        test: testLocal
    }
};

module.exports = {
    getChatModel,
    getModelSettings,
    listLocalModels,
    saveModelSettings,
    testModelSettings
};
