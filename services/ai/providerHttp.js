// What the model adapters share about calling a provider over plain fetch.
const TIMEOUT_MS = 30_000;
// One streamed reply of a turn.
const REPLY_TIMEOUT_MS = 10 * 60 * 1000;

const NOTICES = {
    length: 'The answer was cut off at the length limit.',
    refusal: 'The model declined to answer.'
};

const causeOf = (error) =>
    error.cause?.message || error.cause?.code || error.message;

async function errorOf(response) {
    const { error } = (await response.json().catch(() => null)) ?? {};
    if (typeof error === 'string') return error;
    return error?.message || response.statusText;
}

// The result of a Test call: { ok, status, error }.
async function pingResult(response) {
    if (response.ok) return { ok: true, status: response.status };
    return {
        ok: false,
        status: response.status,
        error: await errorOf(response)
    };
}

// Opens one streamed reply. send(signal) makes the request; the errors name the
// provider by label.
async function openReply(label, send, signal) {
    const timeout = AbortSignal.timeout(REPLY_TIMEOUT_MS);
    let response;
    try {
        response = await send(
            signal ? AbortSignal.any([signal, timeout]) : timeout
        );
    } catch (error) {
        throw new Error(`Could not reach ${label}: ${causeOf(error)}`);
    }
    if (!response.ok) {
        const message = await errorOf(response);
        throw new Error(`${label} returned ${response.status}: ${message}`);
    }
    return response;
}

module.exports = {
    NOTICES,
    TIMEOUT_MS,
    causeOf,
    errorOf,
    openReply,
    pingResult
};
