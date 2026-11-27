Status: ready

# Console: run Redis commands (design `design/RedisDeck (1).html`, "Console" view)

## Problem Statement

People who know Redis want to type commands such as `HGETALL`, `TTL`, `SCAN` or `EXPIRE` against the current Connection and see the reply right away. Today the only way to do that is through the Keys page or a separate `redis-cli`. ADR 0001 removed generic command execution because it left safety to the browser.

## Solution

A **Console** page in web, Docker and Desktop, with a sidebar item below Statistics:

- Tabs of editors with one command per line. Lines starting with `#`, `--` or `//` are comments.
- A check on each line: an error dot for unsupported commands, a commands turned off in the console, or a write on a Read-only connection; a warning dot (for example "KEYS blocks Redis… prefer SCAN"); a "writes data" mark.
- **Run line** (⌘/Ctrl+Enter runs the line under the cursor or the selection), **Choose statements…** (a checklist popup), and **Run all** (⌘/Ctrl+Shift+Enter).
- A results pane with an **Output** tab (a history of `[time] conn> command → summary`) and one tab per statement run.

Commands come from a fixed, server-side allowed list (ADR 0006). The server checks every write with the write guard.

## Decisions

### Allowed list (ADR 0006)

- The server owns the list: command → `read` | `write`, plus optional warnings (KEYS). One GET route serves it, and the client fetches it once for the line check.
- The starting list follows the design's set: PING, ECHO, DBSIZE, SCAN, KEYS, TYPE, TTL, PTTL, EXISTS, GET, STRLEN, HGETALL, HGET, HKEYS, HLEN, LLEN, LRANGE, ZRANGE, ZCARD, TIME, MGET, GETRANGE, HMGET, HEXISTS, HSCAN, SMEMBERS, SCARD, SISMEMBER, SSCAN, ZSCAN, ZSCORE, ZRANK, LINDEX, XLEN, XRANGE, MEMORY USAGE, OBJECT ENCODING/IDLETIME/FREQ, INFO, SLOWLOG GET, CLIENT LIST, CONFIG GET, RANDOMKEY as reads; SET, HSET, HDEL, LPUSH, RPUSH, DEL, UNLINK, EXPIRE, PERSIST, RENAME, INCR, INCRBY, DECR, MSET, SETEX, PEXPIRE, EXPIREAT, HINCRBY, SADD, SREM, ZADD, ZREM, LPOP, RPOP, LREM, LSET, XADD, XDEL as writes. A command with subcommands is allowed only with the listed subcommands.
- These are never on the list: FLUSHDB, FLUSHALL, CONFIG SET, SHUTDOWN, DEBUG, MONITOR, SUBSCRIBE (and PSUBSCRIBE).
- A command that isn't on the list fails on the server with "`<CMD>` is not supported in this console". The line check shows the same message before the command is run.

### Running

- One POST takes the Connection and an ordered list of statements, each with its line number and text. The server tokenizes the text with the design's rules: double quotes with escapes, single quotes, words.
- Statements run in order, one at a time, with no transaction. Execution **stops at the first error**. Statements that did not run get a **Not run** result, and the Output line reads "stopped at line N". Writes that already ran stay applied.
- Guards: if the batch has any write, the write guard runs once for the whole batch. Read-only answers 403 and nothing runs. Confirm writes answers 428, and the UI shows the design's modal listing the writes ("Run N writes on <conn>?"); on production the user types the Connection name. The client retries with the confirmation.
- Transport follows the rest of the app: `redis-cli -c` on clustered Connections (ADR 0002, under the per-Connection spawn cap), and the persistent client on standalone Connections.
- Each result carries the reply, its kind and the duration in ms.

### Results

- The server returns the plain Redis reply. The client renders it by shape:
    - integer, status, bulk and nil as a scalar
    - a flat array as a one-column table
    - a reply of pairs as two columns (HGETALL, ZRANGE WITHSCORES, CONFIG GET)
    - SCAN as the Key list plus a **Continue from cursor N** button, which runs the next SCAN
    - KEYS, SCAN and RANDOMKEY Key names as links that open the Key on the Keys page
    - bulk values and table cells decoded as JSON or PHP, the same way the Keys page decodes them
- A small client-side table says which commands return pairs and which return Key names.
- Tables show at most 500 rows, with "showing 500". A table result has **Copy JSON**.
- An error shows as a red block with the Redis error text, scrubbed of Connection config.

### Tabs

- Tab names and editor text are kept in localStorage for each browser, and reading or writing it never breaks the page. You can add (+), close and rename tabs. The Output history is in memory only.
- The header shows the Tier badge and `<conn> · db<N>`.

### Out of scope

- "Ask about this line" and "Ask about result" (added in the AI assistant spec).
- Multi-line commands, MULTI/EXEC, Lua and pub/sub.
- Logging Console commands anywhere.

## Testing Decisions

- **Route tests against real Redis** (the `test:*` prefix):
    - allowed vs refused commands
    - turned-off commands, and subcommands that aren't listed
    - the tokenizer with quotes
    - stop on error with Not run results
    - Read-only gives 403; Confirm writes gives 428 and then a confirmed retry
    - reply shapes for a scalar, an array, pairs and SCAN
    - a cluster run when `REDIS_TEST_CLUSTER` is set
- **Client:** one test for rendering results by shape and one for the line check.

## Further Notes

- ADR 0006 replaces part of ADR 0001 for the Console only. CLAUDE.md is updated to match.
