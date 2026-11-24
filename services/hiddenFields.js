// Hidden fields: names whose values AI clients never see. One global list in
// the settings table, read on every call so a --mcp process sees edits at once.
const { getDatabase } = require('./database');

const SETTING = 'hidden_fields';
const DEFAULTS = Object.freeze(['password', 'token', 'secret']);
const MASK = '●●●';

function getHiddenFields() {
    const row = getDatabase()
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(SETTING);
    return row ? JSON.parse(row.value) : [...DEFAULTS];
}

// Names are trimmed and lowercased. Throws on empty names or duplicates.
function setHiddenFields(fields) {
    if (!Array.isArray(fields) || fields.some((f) => typeof f !== 'string')) {
        throw new Error('fields must be an array of strings');
    }
    const names = fields.map((f) => f.trim().toLowerCase());
    if (names.some((n) => n === '')) {
        throw new Error('Field names cannot be empty');
    }
    if (new Set(names).size !== names.length) {
        throw new Error('Field names must be unique');
    }
    getDatabase()
        .prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(SETTING, JSON.stringify(names));
    return names;
}

// Mask matching object keys at any depth. Strings that are JSON objects or
// arrays are parsed and masked too; other strings (plain text, PHP-serialized)
// are left alone.
function maskNode(node, hidden) {
    if (typeof node === 'string') {
        const first = node.trimStart()[0];
        if (first !== '{' && first !== '[') return node;
        try {
            return JSON.stringify(maskNode(JSON.parse(node), hidden));
        } catch {
            return node;
        }
    }
    if (Array.isArray(node)) return node.map((n) => maskNode(n, hidden));
    if (node && typeof node === 'object') {
        return Object.fromEntries(
            Object.entries(node).map(([k, v]) => [
                k,
                hidden.has(k.toLowerCase()) ? MASK : maskNode(v, hidden)
            ])
        );
    }
    return node;
}

// Mask a Key value as readKey returns it (string, array or hash object).
function maskValue(value, names = getHiddenFields()) {
    return names.length === 0 ? value : maskNode(value, new Set(names));
}

module.exports = { getHiddenFields, setHiddenFields, maskValue, MASK };
