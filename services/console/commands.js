// The Console's allowed list (ADR 0006): command -> { access, warning? }.
// Anything not listed is refused; a command with subcommands is listed once per
// allowed subcommand. Never add FLUSHDB, FLUSHALL, CONFIG SET, SHUTDOWN, DEBUG,
// MONITOR, SUBSCRIBE or PSUBSCRIBE.
const read = { access: 'read' };
const write = { access: 'write' };

const COMMANDS = {
    PING: read,
    ECHO: read,
    DBSIZE: read,
    SCAN: read,
    KEYS: {
        access: 'read',
        warning: 'KEYS blocks Redis while it walks every key. Prefer SCAN.'
    },
    TYPE: read,
    TTL: read,
    PTTL: read,
    EXISTS: read,
    GET: read,
    STRLEN: read,
    HGETALL: read,
    HGET: read,
    HKEYS: read,
    HLEN: read,
    LLEN: read,
    LRANGE: read,
    ZRANGE: read,
    ZCARD: read,
    'MEMORY USAGE': read,
    'OBJECT ENCODING': read,
    'OBJECT IDLETIME': read,
    'OBJECT FREQ': read,
    INFO: read,
    'SLOWLOG GET': read,
    'CLIENT LIST': read,
    'CONFIG GET': read,
    RANDOMKEY: read,
    SET: write,
    HSET: write,
    HDEL: write,
    LPUSH: write,
    RPUSH: write,
    DEL: write,
    UNLINK: write,
    EXPIRE: write,
    PERSIST: write,
    RENAME: write,
    INCR: write
};

const NAMES = Object.keys(COMMANDS);

// -> { name, entry }; entry is undefined when the command is not allowed.
function lookupCommand([command = '', subcommand = '']) {
    const base = command.toUpperCase();
    const hasSubcommands = NAMES.some((n) => n.startsWith(`${base} `));
    const name =
        hasSubcommands && subcommand
            ? `${base} ${subcommand.toUpperCase()}`
            : base;
    return {
        name,
        entry: Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined
    };
}

module.exports = { COMMANDS, lookupCommand };
