# 04: Line check

**What to build:** Before the user runs anything, each editor line shows its state: an error dot, a warning dot or a "writes data" mark. The check uses the allowed list from the server, fetched once.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Error dot for an unsupported command, with the same message the server gives
- [ ] Error dot for a command turned off in the console
- [ ] Error dot for a write on a Read-only Connection
- [ ] Warning dot where the list carries a warning (for example "KEYS blocks Redis… prefer SCAN")
- [ ] "writes data" mark on write lines
- [ ] Comment lines have no mark
- [ ] The allowed list is fetched once
- [ ] Client test for the line check
