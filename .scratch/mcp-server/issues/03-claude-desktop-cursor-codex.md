# 03: Claude Desktop, Cursor and Codex rows

**What to build:** The AI clients panel also offers one-click install, status, Remove and Manual setup for Claude Desktop, Cursor and Codex. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 02

**Status:** done

- [x] Claude Desktop: JSON `mcpServers` patch in the macOS Claude app-support config
- [x] Cursor: JSON `mcpServers` patch in `~/.cursor/mcp.json`
- [x] Codex: replace or append one `[mcp_servers.redis-deck]` block (`command`, `args`) in `~/.codex/config.toml` as text; no TOML library; lines outside the block are kept byte-for-byte; never shells out to `codex`
- [x] Missing files and folders are created on install
- [x] Installer tests per client: missing file, existing content kept, Installed / Stale / Not installed, Reinstall, Remove
