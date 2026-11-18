// Config format: a JSON file with a top-level `mcpServers` object (Claude Code,
// Claude Desktop, Cursor). Pure text in, text out; the installer does the I/O.
const { InstallerError } = require('../errors');

function parse(text, file) {
    if (text === null || text.trim() === '') return {};
    let doc;
    try {
        doc = JSON.parse(text);
    } catch {
        throw new InstallerError(`${file} is not valid JSON`, 409);
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        throw new InstallerError(`${file} is not a JSON object`, 409);
    }
    return doc;
}

const print = (doc) => JSON.stringify(doc, null, 2) + '\n';

// The stored entry for `name`, or null when absent.
function read(text, name, file) {
    const entry = parse(text, file).mcpServers?.[name];
    return entry && typeof entry === 'object' ? entry : null;
}

function write(text, name, entry, file) {
    const doc = parse(text, file);
    doc.mcpServers = { ...doc.mcpServers, [name]: entry };
    return print(doc);
}

// Unchanged text when there is no entry to remove.
function remove(text, name, file) {
    const doc = parse(text, file);
    if (!doc.mcpServers?.[name]) return text;
    delete doc.mcpServers[name];
    return print(doc);
}

const snippet = (name, entry) => print({ mcpServers: { [name]: entry } });

module.exports = { read, write, remove, snippet };
