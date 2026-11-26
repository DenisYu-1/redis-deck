// Model settings of the AI assistant. The API key leaves the server only towards
// the provider: callers get its last four characters, and error texts are
// scrubbed of it.
const { getDatabase } = require('./database');
const anthropic = require('./ai/anthropic');

const DEFAULTS = Object.freeze({
    mode: 'api',
    provider: 'anthropic',
    model: anthropic.DEFAULT_MODEL,
    api_key: ''
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

function getModelSettings() {
    const { mode, provider, model, api_key } = readRow();
    return {
        mode,
        provider,
        model,
        models: anthropic.MODELS,
        keyLast4: lastFour(api_key)
    };
}

// Validates a request body; a blank apiKey means "the stored one". Error
// messages must never include the key.
function parse(body = {}) {
    const { mode, provider, model, apiKey = '' } = body;
    if (mode !== 'api') throw new Error('Unknown mode');
    if (provider !== 'anthropic') throw new Error('Unknown provider');
    if (!anthropic.MODELS.includes(model)) throw new Error('Unknown model');
    if (typeof apiKey !== 'string') throw new Error('apiKey must be text');
    const typed = apiKey.trim();
    // fetch refuses anything else as a header value, in an error quoting it.
    if (!/^[\x21-\x7e]*$/.test(typed)) {
        throw new Error('The API key contains characters a key cannot have');
    }
    return { mode, provider, model, apiKey: typed || readRow().api_key };
}

function saveModelSettings(body) {
    const { mode, provider, model, apiKey } = parse(body);
    getDatabase()
        .prepare(
            `INSERT INTO ai_model (id, mode, provider, model, api_key)
             VALUES (1, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET mode = excluded.mode,
                 provider = excluded.provider, model = excluded.model,
                 api_key = excluded.api_key`
        )
        .run(mode, provider, model, apiKey);
    return getModelSettings();
}

const failed = (title, detail) => ({ ok: false, title, detail });

// One call with the typed (or stored) key; saves nothing. Resolves to
// { ok, title, detail }; throws only for invalid input.
async function testModelSettings(body) {
    const { model, apiKey } = parse(body);
    if (!apiKey) {
        return failed('No API key', 'Paste a key, then test again.');
    }
    const scrub = (text) => String(text).replaceAll(apiKey, '●●●');
    const started = Date.now();
    try {
        const result = await anthropic.ping({ apiKey, model });
        if (!result.ok) {
            return failed(
                `Anthropic returned ${result.status}`,
                scrub(result.error)
            );
        }
        return {
            ok: true,
            title: `Anthropic replied in ${Date.now() - started} ms`,
            detail: `Model ${model} with tool use.`
        };
    } catch (error) {
        return failed(
            'Could not reach Anthropic',
            scrub(error.cause?.message || error.message)
        );
    }
}

module.exports = { getModelSettings, saveModelSettings, testModelSettings };
