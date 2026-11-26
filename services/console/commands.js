// The Console's allowed list (ADR 0006): command -> { access, keyless?, warning? }.
// Anything not listed is refused; a command with subcommands is listed once per
// allowed subcommand. Never add FLUSHDB, FLUSHALL, CONFIG SET, SHUTDOWN, DEBUG,
// MONITOR, SUBSCRIBE or PSUBSCRIBE.
const read = { access: 'read' };
const write = { access: 'write' };
// A read without a Key: on a cluster `redis-cli -c` has nothing to redirect, so
// one Node answers and the result names it.
const keyless = { access: 'read', keyless: true };

const COMMANDS = {
    PING: keyless,
    ECHO: keyless,
    DBSIZE: keyless,
    SCAN: keyless,
    KEYS: {
        ...keyless,
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
    INFO: keyless,
    'SLOWLOG GET': keyless,
    'CLIENT LIST': keyless,
    'CONFIG GET': keyless,
    RANDOMKEY: keyless,
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
