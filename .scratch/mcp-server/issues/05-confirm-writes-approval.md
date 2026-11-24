# 05: Approval dialog for Confirm writes

**What to build:** When an AI client writes to a Confirm writes Connection, a native Redis Deck dialog asks the user. It names the AI client, Connection, Tier, operation and Key. Deny refuses the write, Allow once runs it, and Allow for this session runs it and skips the prompt for that Connection for up to 1 hour. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 04

**Status:** done

- [x] Native dialog from the `--mcp` process: Deny (default and cancel) / Allow once / Allow for this session
- [x] Closed dialog or 60 s with no answer = Deny; AI client gets "user denied"
- [x] AI client name taken from the MCP initialize client info
- [x] Session grant kept in memory, per Connection, expires 1 h after it was granted or when the process exits
- [x] Dock icon visible only while a dialog is open
- [x] Seam tests with stub approver and fake clock: Deny, Allow once (next write asks again), Allow for this session (next write no prompt; asks again after 1 h)
