# 04: Key write tools with the Read-only guard

**What to build:** An AI client can set, delete, rename and change the TTL of Keys, add to sorted sets and edit collection members. Writes on Connections without Read-only or Confirm writes run right away; Read-only connections reject them with a clear error. Until 05 lands, Confirm writes Connections reject MCP writes too. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 01

**Status:** done

- [x] Write tools: set Key, delete Key, rename Key, set/remove TTL, sorted-set add, collection member edits; they call existing services, not HTTP
- [x] Guard rule in the MCP module reuses the write guard's Connection lookup: Read-only → blocked; Confirm writes → blocked for now; otherwise allowed
- [x] A confirmation sent by the AI client is never accepted
- [x] Not exposed: flush, bulk delete by Key pattern, Connection management, generic command execution
- [x] Blocked writes return a clear error ("Connection is read-only")
- [x] Seam tests: each tool's effect on Redis, Read-only blocks, plain Connection writes, excluded operations are not listed
