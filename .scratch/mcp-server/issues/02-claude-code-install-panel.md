# 02: One-click install for Claude Code + AI clients panel

**What to build:** In the Desktop app, the Connections page shows an "AI clients (MCP)" panel. The Claude Code row shows Not installed / Installed / Stale and offers Install, Reinstall, Remove and Manual setup. One click makes Claude Code able to use Redis Deck after a restart. Not shown in web or Docker. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 01

**Status:** done

- [x] Client config installer module working on an injectable home directory: `status`, `install`, `remove`, `snippet`
- [x] Claude Code: patches the `redis-deck` entry under `mcpServers` in `~/.claude.json`, keeps all other content, creates the file if missing; never shells out to the `claude` CLI
- [x] Status: Installed when the command and args match the current binary, Stale when they differ, Not installed when absent; Reinstall fixes Stale; Remove deletes only the `redis-deck` entry
- [x] Binary path: packaged app executable + `--mcp`; in `electron:dev`, the dev Electron binary + repo path + `--mcp`
- [x] Installer routes (list with status, install, remove, snippet) mounted only when the server runs embedded in the Desktop app
- [x] Panel on the Connections page, Desktop app only: status per row, buttons, Manual setup popup (path, snippet, Copy button), restart hint after install
- [x] Installer tests on a temp home: missing file, existing file with unrelated content, all three statuses, Reinstall, Remove
