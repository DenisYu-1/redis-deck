// The Console's allowed list (ADR 0006): command -> { access, warning? }.
// Anything not listed is refused; a command with subcommands is listed once per
// allowed subcommand. Never add anything in TURNED_OFF.
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

// Never allowed: they can wipe or stall a server. They get their own message.
const TURNED_OFF = [
    'FLUSHDB',
    'FLUSHALL',
    'CONFIG SET',
    'SHUTDOWN',
    'DEBUG',
    'MONITOR',
    'SUBSCRIBE',
    'PSUBSCRIBE'
];

// The page fills {command} too, so its line check says what a run would say.
const UNSUPPORTED = '{command} is not supported in this console';

const disabled = (name) => `${name} is disabled in the console`;

const TURNED_OFF_MESSAGES = Object.fromEntries(
    TURNED_OFF.map((name) => [name, disabled(name)])
);

// Why a command that is not on the list is refused.
const refusalMessage = (name) =>
    TURNED_OFF.includes(name)
        ? disabled(name)
        : UNSUPPORTED.replace('{command}', () => name);

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

module.exports = {
    COMMANDS,
    TURNED_OFF_MESSAGES,
    UNSUPPORTED,
    lookupCommand,
    refusalMessage
};
