// Enforces Read-only / Confirm-writes on the server (ADR 0001): 403 when the
// Connection is Read-only; 428 when it asks for confirmation and the
// X-Confirm-Connection header does not equal the connection id.
const { getConnection } = require('../services/database');

const CONFIRM_HEADER = 'x-confirm-connection';

// Commands known to be side-effect free. Anything not listed counts as a write
// (fail closed), so an unknown or new command can never slip past a guard.
const READ_COMMANDS = new Set(
    (
        'GET MGET GETRANGE STRLEN EXISTS TYPE TTL PTTL EXPIRETIME PEXPIRETIME ' +
        'KEYS SCAN DBSIZE RANDOMKEY OBJECT DUMP MEMORY TOUCH ' +
        'HGET HGETALL HMGET HKEYS HVALS HLEN HEXISTS HSCAN HSTRLEN HRANDFIELD ' +
        'LRANGE LLEN LINDEX LPOS ' +
        'SMEMBERS SCARD SISMEMBER SMISMEMBER SSCAN SRANDMEMBER SDIFF SINTER SUNION SINTERCARD ' +
        'ZRANGE ZRANGEBYSCORE ZRANGEBYLEX ZREVRANGE ZREVRANGEBYSCORE ZREVRANGEBYLEX ' +
        'ZCARD ZCOUNT ZLEXCOUNT ZSCORE ZMSCORE ZRANK ZREVRANK ZSCAN ZRANDMEMBER ZDIFF ZINTER ZUNION ' +
        'XRANGE XREVRANGE XLEN XREAD XINFO ' +
        'PING ECHO INFO TIME LASTSAVE SLOWLOG CONFIG COMMAND CLIENT CLUSTER ' +
        'PUBSUB BITCOUNT BITPOS GETBIT PFCOUNT GEOPOS GEODIST GEOHASH GEORADIUS_RO ' +
        'GEOSEARCH LOLWUT LATENCY MEMORY SELECT'
    ).split(/\s+/)
);

// Sub-commands that mutate even though the base command is a read.
const WRITE_SUBCOMMANDS = {
    CONFIG: new Set(['SET', 'REWRITE', 'RESETSTAT']),
    SLOWLOG: new Set(['RESET']),
    CLIENT: new Set(['KILL', 'PAUSE', 'UNPAUSE', 'SETNAME', 'NO-EVICT']),
    CLUSTER: new Set([
        'ADDSLOTS',
        'DELSLOTS',
        'FAILOVER',
        'FORGET',
        'MEET',
        'RESET',
        'REPLICATE',
        'SETSLOT',
        'FLUSHSLOTS'
    ]),
    MEMORY: new Set(['PURGE']),
    LATENCY: new Set(['RESET']),
    XINFO: new Set([])
};

function firstTokens(command) {
    let c = String(command).trim();
    if (c.startsWith('--raw ')) {
        c = c.slice(6).trim();
    }
    const [cmd = '', sub = ''] = c.split(/\s+/);
    return [cmd.toUpperCase(), sub.toUpperCase()];
}

function isWriteCommand(command) {
    const [cmd, sub] = firstTokens(command);
    if (!READ_COMMANDS.has(cmd)) {
        return true;
    }
    return Boolean(WRITE_SUBCOMMANDS[cmd]?.has(sub));
}

// Returns null when the write may proceed, else { status, error }.
function checkWrite(connectionId, headers = {}) {
    const conn = getConnection(connectionId);
    if (!conn) {
        return null; // unknown connection: the route reports 404/500 itself
    }
    if (conn.read_only === 1) {
        return {
            status: 403,
            error: `Connection '${connectionId}' is read-only`
        };
    }
    if (conn.confirm_writes === 1 && headers[CONFIRM_HEADER] !== connectionId) {
        return {
            status: 428,
            error: `Writes to '${connectionId}' need confirmation: send X-Confirm-Connection: ${connectionId}`
        };
    }
    return null;
}

// Middleware factory. `resolve(req)` returns the connection id(s) being
// written to and may return [] when the request turns out to be a read.
function writeGuard(resolve = (req) => [req.query.env]) {
    return (req, res, next) => {
        for (const id of [].concat(resolve(req)).filter(Boolean)) {
            const refusal = checkWrite(id, req.headers);
            if (refusal) {
                return res
                    .status(refusal.status)
                    .json({ error: refusal.error, code: refusal.status });
            }
        }
        next();
    };
}

// For routes that run caller-supplied commands: guard only if one is a write.
const guardCommands = (getCommands) =>
    writeGuard((req) =>
        [].concat(getCommands(req) ?? []).some((c) => isWriteCommand(c))
            ? [req.body?.env ?? req.query.env]
            : []
    );

module.exports = { writeGuard, guardCommands, isWriteCommand, checkWrite };
