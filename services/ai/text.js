// Small text rules of the assistant's code.

/** The text with every occurrence of a secret (API key, token) masked. */
const maskSecret = (text, secret) =>
    secret ? String(text).replaceAll(secret, '●●●') : String(text);

/** A request field: its trimmed text, '' when it is not text. */
const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

module.exports = { maskSecret, trimmed };
