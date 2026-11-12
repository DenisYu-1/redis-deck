// URL policy for the Electron window: external links open in the OS browser only
// for http(s); in-window navigation never leaves the app's local origin.
function isSafeExternalUrl(raw) {
    try {
        const { protocol } = new URL(raw);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

function isSameOrigin(raw, origin) {
    try {
        return new URL(raw).origin === new URL(origin).origin;
    } catch {
        return false;
    }
}

module.exports = { isSafeExternalUrl, isSameOrigin };
