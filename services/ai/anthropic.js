// Anthropic Messages API over plain fetch (no SDK).
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const TIMEOUT_MS = 30_000;

const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';

// The smallest call that proves the key and model work. Returns
// { ok, status, error }; throws when Anthropic cannot be reached.
async function ping({ apiKey, model }) {
    const response = await fetch(MESSAGES_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (response.ok) return { ok: true, status: response.status };
    const body = await response.json().catch(() => null);
    return {
        ok: false,
        status: response.status,
        error: body?.error?.message || response.statusText
    };
}

module.exports = { MODELS, DEFAULT_MODEL, ping };
