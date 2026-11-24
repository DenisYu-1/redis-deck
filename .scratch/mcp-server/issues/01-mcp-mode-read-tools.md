# 01: `--mcp` mode with read tools

**What to build:** Starting the Desktop app binary with `--mcp` runs a stdio MCP server that an AI client can use without the window open and alongside a running app. An AI client can list Connections, scan Keys by Key pattern, get a Key and read INFO. Demoable by adding the config to Claude Code by hand. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] MCP SDK added as a dependency (yarn)
- [x] `--mcp` is detected before the single-instance lock, so it never takes the lock and never blocks the normal app; it opens no window and no HTTP listener
- [x] `--mcp` sets the same `DATA_DIR` and bundled `redis-cli` as the normal app; only protocol output goes to stdout
- [x] MCP server module built with injected dependencies (approver, clock), even though only reads exist yet
- [x] Tools: list Connections (id, name, Tier, Read-only, Confirm writes; no passwords or TLS key material), scan Keys (capped count), get Key (type, TTL, size, value truncated), INFO
- [x] Error messages never echo Connection config
- [x] Tests at the in-process seam (SDK in-memory transport, real Redis, `test:*` Keys) cover each tool, the scan cap, value truncation and secret stripping
- [x] Packaged smoke script starts the binary with `--mcp`, sends `initialize` and asserts a valid response
