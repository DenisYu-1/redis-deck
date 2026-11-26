// Addresses of model servers, as the user types them.

// -> the normalized URL without a trailing slash, so that equal addresses
// compare equal. The messages must not quote the input: it may hold a password.
function serverUrl(value, name) {
    const typed = typeof value === 'string' ? value.trim() : '';
    if (!typed) throw new Error(`Enter the ${name}`);
    let url;
    try {
        url = new URL(typed);
    } catch {
        url = null;
    }
    if (url?.protocol !== 'http:' && url?.protocol !== 'https:') {
        throw new Error(`The ${name} must start with http:// or https://`);
    }
    if (url.username || url.password || url.search || url.hash) {
        throw new Error(
            `The ${name} cannot hold a user name, password, query or fragment`
        );
    }
    return url.href.replace(/\/+$/, '');
}

// Where a Local model server has its OpenAI-compatible API: under /v1 (Ollama
// and most others) unless the URL names a path itself.
function apiRoot(localUrl) {
    return new URL(localUrl).pathname === '/' ? `${localUrl}/v1` : localUrl;
}

module.exports = { apiRoot, serverUrl };
