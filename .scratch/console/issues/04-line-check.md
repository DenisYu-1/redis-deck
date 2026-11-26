# 04: Line check

**What to build:** Before the user runs anything, each editor line shows its state: an error dot, a warning dot or a "writes data" mark. The check uses the allowed list from the server, fetched once.

**Blocked by:** 03

**Status:** done

- [x] Error dot for an unsupported command, with the same message the server gives
- [x] Error dot for a command turned off in the console
- [x] Error dot for a write on a Read-only Connection
- [x] Warning dot where the list carries a warning (for example "KEYS blocks Redis… prefer SCAN")
- [x] "writes data" mark on write lines
- [x] Comment lines have no mark
- [x] The allowed list is fetched once
- [x] Client test for the line check
