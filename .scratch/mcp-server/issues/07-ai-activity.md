# 07: AI activity

**What to build:** Every AI write and every denied or blocked attempt is recorded in AI activity. In the AI clients panel the user can turn off "Log AI operations" (on by default) and open View activity: a table of time, AI client, Connection, operation, Key or Workflow and result, filterable by Connection. Entries older than 30 days are removed. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 02, 05

**Status:** done

- [x] Versioned migration adds the AI activity table (time, AI client, Connection id, operation, Key/Workflow, result `done`/`denied`/`blocked`/`failed`, optional error)
- [x] MCP module logs writes and denied/blocked/failed attempts; reads are never logged
- [x] "Log AI operations" setting in SQLite, on by default; `--mcp` reads it when logging, so changes apply without restarting the AI client
- [x] Routes: list (Connection filter, paged, newest first) and get/set of the toggle
- [x] Panel: checkbox and View activity modal with Connection filter
- [x] The 24 h cleanup loop removes entries older than 30 days
- [x] Seam tests: rows for done/denied/blocked, none for reads, none when the toggle is off; route tests for list, filter, ordering, toggle and cleanup
