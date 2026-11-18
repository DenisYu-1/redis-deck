// Config format: Codex's ~/.codex/config.toml, handled as plain text (no TOML
// library). We own one `[mcp_servers.<name>]` block with `command` and `args`;
// every line outside that block is kept byte-for-byte.
const { InstallerError } = require('../errors');

// JSON string escapes are valid TOML basic-string escapes.
const quote = (s) => JSON.stringify(s);

const block = (name, { command, args }) =>
    `[mcp_servers.${name}]\n` +
    `command = ${quote(command)}\n` +
    `args = [${args.map(quote).join(', ')}]\n`;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isHeader = (line) => /^\s*\[/.test(line);
const headerRe = (name) => {
    const n = escapeRe(name);
    return new RegExp(
        `^\\s*\\[\\s*mcp_servers\\s*\\.\\s*(?:${n}|"${n}"|'${n}')\\s*\\]\\s*(?:#.*)?$`
    );
};

// Lines keep their '\r' so untouched lines are written back unchanged.
const splitLines = (text) => (text ? text.split('\n') : []);

// [start, end) line range of our table: its header up to the next header.
function findBlock(lines, name) {
    const re = headerRe(name);
    const start = lines.findIndex((line) => re.test(line));
    if (start === -1) return null;
    let end = start + 1;
    while (end < lines.length && !isHeader(lines[end])) end++;
    // Blank lines before the next table are not ours.
    while (end > start + 1 && lines[end - 1].trim() === '') end--;
    return { start, end };
}

// Strings in order, skipping comments, from `src` up to an unquoted ']'.
const TOKEN = /"((?:[^"\\\n]|\\.)*)"|'([^'\n]*)'|(\])|#[^\n]*/g;
function strings(src, stopAtBracket) {
    const out = [];
    for (const m of src.matchAll(TOKEN)) {
        if (m[3]) {
            if (stopAtBracket) break;
            continue;
        }
        if (m[1] !== undefined) {
            try {
                out.push(JSON.parse(`"${m[1]}"`));
            } catch {
                out.push(undefined); // TOML-only escape: reads as Stale
            }
        } else if (m[2] !== undefined) out.push(m[2]);
    }
    return out;
}

function valueAfter(body, key) {
    const m = new RegExp(`^\\s*${key}\\s*=`, 'm').exec(body);
    return m ? body.slice(m.index + m[0].length) : null;
}

// The stored `command` and `args`, or null when there is no block.
function read(text, name) {
    const lines = splitLines(text);
    const found = findBlock(lines, name);
    if (!found) return null;
    const body = lines.slice(found.start + 1, found.end).join('\n');
    const cmd = valueAfter(body, 'command');
    const args = valueAfter(body, 'args');
    return {
        command: cmd === null ? undefined : strings(cmd.split('\n')[0])[0],
        args:
            args !== null && args.trimStart().startsWith('[')
                ? strings(args.trimStart().slice(1), true)
                : undefined
    };
}

// `redis-deck = {...}` under [mcp_servers], or a root `mcp_servers.redis-deck…`
// dotted key: defined in a form we do not rewrite, and appending a table
// would make the file invalid.
function definedElsewhere(lines, name) {
    const n = escapeRe(name);
    const key = `(?:${n}|"${n}"|'${n}')\\s*[.=]`;
    const inTable = new RegExp(`^\\s*${key}`);
    const atRoot = new RegExp(`^\\s*mcp_servers\\s*\\.\\s*${key}`);
    let table = null;
    return lines.some((line) => {
        if (isHeader(line)) {
            table = line.replace(/#.*/, '').replace(/\s/g, '');
            return false;
        }
        return table === null
            ? atRoot.test(line)
            : table === '[mcp_servers]' && inTable.test(line);
    });
}

// Replace our block in place, or append it after a blank line.
function write(text, name, entry, file) {
    const next = block(name, entry);
    if (!text) return next;
    const lines = splitLines(text);
    const found = findBlock(lines, name);
    if (!found && definedElsewhere(lines, name)) {
        throw new InstallerError(
            `${file} defines ${name} in a form Redis Deck cannot rewrite; ` +
                'edit it by hand (see Manual setup)',
            409
        );
    }
    if (!found) return text + (text.endsWith('\n') ? '\n' : '\n\n') + next;
    lines.splice(
        found.start,
        found.end - found.start,
        ...next.split('\n').slice(0, -1)
    );
    return lines.join('\n');
}

// Our table or one of its sub-tables, e.g. [mcp_servers.redis-deck.env].
const ownRe = (name) => {
    const n = escapeRe(name);
    return new RegExp(
        `^\\s*\\[\\[?\\s*mcp_servers\\s*\\.\\s*(?:${n}|"${n}"|'${n}')\\s*[\\].]`
    );
};

// Drops our table, its sub-tables and the blank lines that separate them,
// so Remove after Install gives back the original text. Unchanged text when
// there is nothing to remove.
function remove(text, name) {
    const re = ownRe(name);
    const lines = splitLines(text);
    let changed = false;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!re.test(lines[i])) continue;
        changed = true;
        let end = i + 1;
        while (end < lines.length && !isHeader(lines[end])) end++;
        let start = i;
        if (end === lines.length) {
            // Last table: eat the blank lines above, keep the final newline.
            while (start > 0 && lines[start - 1].trim() === '') start--;
            end = text.endsWith('\n') ? lines.length - 1 : lines.length;
            if (start === 0) end = lines.length;
        }
        lines.splice(start, end - start);
    }
    return changed ? lines.join('\n') : text;
}

const snippet = (name, entry) => block(name, entry);

module.exports = { read, write, remove, snippet };
