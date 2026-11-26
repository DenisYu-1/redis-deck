# 01: Run one read line

**What to build:** A Console page with a sidebar item below Statistics. The header shows the Tier badge and `<conn> · db<N>`. The user types commands in one editor, presses Run line (⌘/Ctrl+Enter, the line under the cursor or the selection) and sees the reply. The server owns the allowed list (ADR 0006), serves it on a GET route, and runs statements from one POST route. This ticket covers standalone Connections, and the list holds only the read commands from the spec, so no write can run before the write guard is in place.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The Console page is reachable from the sidebar and shows the Tier badge and `<conn> · db<N>`
- [x] The GET route serves the allowed list: command → `read`, plus warnings (KEYS)
- [x] The POST route takes the Connection and an ordered list of statements, each with its line number and text, and tokenizes with the existing quote-aware tokenizer
- [x] A command or subcommand that is not on the list fails with "`<CMD>` is not supported in this console"
- [x] FLUSHDB, FLUSHALL, CONFIG SET, SHUTDOWN, DEBUG, MONITOR, SUBSCRIBE, PSUBSCRIBE and every write command are refused
- [x] Each result carries the reply, its kind and the duration in ms
- [x] Integer, status, bulk and nil show as a scalar; a flat array shows as a one-column table
- [x] An error shows as a red block with the Redis error text, scrubbed of Connection config
- [x] Console commands are not logged anywhere, including server output
- [x] Route tests against real Redis (`test:*`): allowed, refused, unlisted subcommand, quoted arguments
