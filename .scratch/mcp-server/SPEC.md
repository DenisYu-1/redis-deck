Status: done

# MCP server in the Desktop app with one-click AI client install

## Problem Statement

Users of the **Desktop app** also work with AI clients (Claude Desktop, Claude Code, Codex, Cursor). Today those AI clients cannot see or change anything in the user's Redis instances through Redis Deck. Hooking up an MCP server by hand means finding config files, writing JSON or TOML, and knowing the binary path inside an app bundle. That is too slow and fiddly. Users want what Tabularis offers: one click, and it is installed.

## Solution

The **Desktop app** binary gets an `--mcp` mode. In this mode it runs as a stdio MCP server, started by the **AI client** as a child process. It needs no open window, no network port and no token. It shows the user's saved **Connections** and offers read tools plus a fixed set of write tools that respect **Read-only connection** and **Confirm writes**:

- **Read-only connection**: every MCP write is blocked.
- **Confirm writes**: Redis Deck shows a native approval dialog (Deny / Allow once / Allow for this session).
- Any other **Connection**: MCP writes run right away.

A new "AI clients (MCP)" panel on the Connections page has one row per **AI client**. Each row shows status (Not installed / Installed / Stale) and buttons for Install, Reinstall, Remove and Manual setup. The same panel holds a "Log AI operations" checkbox and a View activity button that opens the **AI activity** log.

## User Stories

1. As a Desktop app user, I want to click Install next to Claude Desktop, so that Claude Desktop can use my Connections without me editing any file.
2. As a Desktop app user, I want to click Install next to Claude Code, so that Claude Code can use my Connections.
3. As a Desktop app user, I want to click Install next to Codex, so that Codex can use my Connections.
4. As a Desktop app user, I want to click Install next to Cursor, so that Cursor can use my Connections.
5. As a Desktop app user, I want each AI client row to show Not installed, Installed or Stale, so that I know the current state at a glance.
6. As a Desktop app user who moved the app to another folder, I want the row to show Stale with a Reinstall button, so that I can repair a broken config in one click.
7. As a Desktop app user, I want a Remove button per AI client, so that I can undo the install in one click.
8. As a Desktop app user, I want a Manual setup button that opens a popup with the exact config snippet, the config file path and a Copy button, so that I can set up an AI client by hand or one that is not listed.
9. As a Desktop app user, I want Install to keep everything else in the AI client's config file untouched, so that my other MCP servers and settings survive.
10. As a Desktop app user whose AI client config file does not exist yet, I want Install to create it and its folder, so that installing works on a fresh machine.
11. As a Desktop app user, I want a hint to restart the AI client after install, so that I know why the tools do not show up yet.
12. As a Desktop app user, I want the MCP server to work while the Redis Deck window is closed, so that my AI client is not tied to having the app open.
13. As an AI client, I want to list Connections with id, name, Tier, Read-only and Confirm writes flags, so that I can pick the right one and know which writes are possible.
14. As a security-minded user, I want passwords and other secrets never to show up in tool output, so that the AI client never sees credentials.
15. As an AI client, I want to scan Keys on a Connection with a Key pattern and get a capped result, so that I can explore data without flooding the context.
16. As an AI client, I want to get a Key's type, TTL, size and value with large values truncated, so that I can inspect data safely.
17. As an AI client, I want to read a Connection's INFO, so that I can answer questions about server health and memory.
18. As an AI client, I want to list the available Workflows with their inputs, so that I can use them.
19. As an AI client, I want to dry-run a Workflow (plan) and then run it, so that I can preview a change before it happens.
20. As an AI client, I want to set a Key, so that I can create or update data.
21. As an AI client, I want to delete a Key, so that I can remove data.
22. As an AI client, I want to rename a Key, so that I can restructure data.
23. As an AI client, I want to set or remove a Key's TTL, so that I can control expiry.
24. As an AI client, I want to add members to sorted sets and other collections, matching the app's existing member edits, so that I can edit collection Keys.
25. As a user with a Read-only connection, I want every MCP write on it rejected with a clear message, so that an AI client can never change it.
26. As a user with a Confirm writes Connection, I want a native Redis Deck dialog naming the AI client, the Connection, its Tier, the operation and the Key, so that I decide on each write with full context.
27. As a user, I want Deny to be the default dialog button, so that pressing Enter by mistake never approves a write.
28. As a user, I want a dialog that I close or leave unanswered for 60 seconds to count as Deny, so that an unattended machine never approves writes.
29. As a user, I want "Allow for this session" to cover further writes on that Connection from that AI client session, so that I am not asked fifty times in a row.
30. As a user, I want a session approval to end after at most 1 hour or when the AI client session ends, whichever comes first, so that a long-lived Claude Desktop session does not keep prod open all week.
31. As a user, I want writes on Connections without Read-only or Confirm writes to run with no prompt, so that local and dev work is fast.
32. As an AI client, I want a denied or blocked write to return a clear error ("user denied", "Connection is read-only"), so that I can tell the user what happened.
33. As a user, I want AI clients unable to flush a database or bulk-delete by Key pattern, so that one bad agent step cannot wipe a Connection.
34. As a user, I want AI clients unable to create, edit, delete or import Connections, so that my Connection setup and stored passwords stay out of their reach.
35. As a user, I want AI clients unable to run arbitrary Redis commands, so that only the known, guarded operations are available.
36. As a user, I want every AI write and every denied or blocked attempt recorded in AI activity, so that I can see what an AI client did.
37. As a user, I want each AI activity entry to show time, AI client, Connection, operation, Key and result (done, denied, blocked, failed), so that I can review what happened.
38. As a user, I want a View activity modal with a Connection filter, so that I can check what happened on one Connection.
39. As a user, I want a "Log AI operations" checkbox, on by default, so that I can turn the logging off if I do not want it.
40. As a user, I want AI activity entries older than 30 days removed automatically, so that the log does not grow forever.
41. As a user, I want reads not logged, so that the log stays readable.
42. As a maintainer, I want `yarn electron:dev` to support installing an AI client against the dev build, so that I can test MCP end to end without packaging.
43. As a maintainer, I want the packaged smoke check to confirm that `--mcp` answers an MCP initialize request, so that broken MCP packaging is caught before release.
44. As a web or Docker user, I want no MCP panel, so that I am not offered something that cannot work in my setup.
45. As a Desktop app user, I want the `--mcp` process not to open a window or block me from launching the app normally, so that both run side by side.
46. As a Desktop app user, I want no permanent dock icon from the `--mcp` process, only while an approval dialog is open, so that a background server does not clutter my dock.

## Implementation Decisions

- **Transport**: stdio only, using the official MCP SDK (new dependency). The AI client starts the Desktop app binary with `--mcp`. There is no HTTP endpoint and no port discovery, so the server works with the window closed.
- **`--mcp` mode in the Electron main module**: detected before the single-instance lock, so it never takes the lock and never blocks the normal app. It sets the same `DATA_DIR` and bundled `REDIS_CLI_PATH` as the normal app, boots only the services (no Express listener, no BrowserWindow) and serves MCP on stdin/stdout. It stays a real Electron process, not `ELECTRON_RUN_AS_NODE`, so it can show native dialogs. The dock icon is hidden except while a dialog is open. Nothing except protocol output may go to stdout.
- **Shared SQLite**: the app and one or more `--mcp` processes open the same database. Per-process state (the `redis-cli` cap and the topology cache) stays per process. This is acceptable.
- **MCP server module (new, deep)**: built with injected dependencies. The main one is an `approver(request) → 'deny' | 'once' | 'session'`, plus a clock for the session cap. In production the approver is the native dialog. In tests it is a stub. The module owns the tool registry, the guard rules, the session grants and the AI activity logging.
- **Tools.** They call the existing services and never go through HTTP.
  - Reads: list Connections, scan Keys (capped count), get Key (truncated value), INFO, list Workflows.
  - Writes: set Key, delete Key, rename Key, set/remove TTL, sorted-set add, collection member edits, Workflow plan, Workflow run.
  - Not exposed: flush, bulk delete Job by Key pattern, Connection management, generic command execution.
  - Workflow plan is a read; Workflow run is a write.
- **Guard rules for MCP writes.** These reuse the write guard's Connection lookup; the decision is made in the MCP module.
  - Read-only connection: blocked.
  - Confirm writes: ask the approver.
  - Otherwise: allowed right away.
  - Confirm writes never accepts a confirmation sent by the AI client.
- **Approval dialog**: Deny / Allow once / Allow for this session, with Deny as the default and cancel button. A 60 s timeout counts as Deny. The dialog text names the AI client (from the MCP initialize client info), the Connection name, the Tier, the operation and the Key or Workflow.
- **Session grant**: kept in memory and keyed by Connection within the `--mcp` process. It expires 1 h after it was granted or when the process exits.
- **No secrets in output**: the Connection listing strips passwords, usernames-with-secrets and TLS key material. Error messages never echo Connection config.
- **AI activity**: a new SQLite table added through a versioned migration (ADR 0004). Columns: time, AI client, Connection id, operation, Key or Workflow, result (`done` / `denied` / `blocked` / `failed`), and an optional error. Writes and denied or blocked attempts are logged; reads are not. The 24 h cleanup loop also removes entries older than 30 days.
- **Log toggle**: a single app setting, "Log AI operations", on by default and stored in SQLite. The `--mcp` process reads it when it logs, so a change applies without restarting the AI client.
- **AI activity API**: a new router with list (filter by Connection, paged, newest first) and get/set of the log toggle. These are app settings, not Redis writes, so the write guard is not involved.
- **Client config installer module (new, deep)**: works on an injectable home directory. Interface: `status(client)`, `install(client)`, `remove(client)` and `snippet(client)`, where `snippet` returns the path plus the text for the Manual setup popup.
  - Clients and files: Claude Desktop (macOS app-support JSON), Claude Code (`~/.claude.json`), Cursor (`~/.cursor/mcp.json`), all patched as JSON `mcpServers` entries; Codex (`~/.codex/config.toml`), handled as text: replace or append one `[mcp_servers.redis-deck]` block, with no TOML library and no other lines touched.
  - Server entry name: `redis-deck`.
  - Status rules: Installed when the entry's command and args match the current binary; Stale when the entry exists but differs; Not installed when absent.
  - Missing files and folders are created on install. Remove deletes only the `redis-deck` entry.
  - The installer writes files directly and never shells out to the clients' CLIs, because apps launched from Finder do not get the shell PATH.
- **Binary path**: when packaged, the app executable plus `--mcp`. In `electron:dev`, the dev Electron binary plus the repo path plus `--mcp`.
- **Installer API**: Desktop-only routes for the list with status, install, remove and snippet. They are mounted only when the server runs embedded in the Desktop app.
- **Frontend**: an "AI clients (MCP)" panel on the Connections page, rendered only in the Desktop app. It has a row per AI client with status and buttons, a Manual setup popup with a Copy button, a restart hint after install, the "Log AI operations" checkbox and the View activity modal with a Connection filter.
- **Glossary**: **AI client** and **AI activity** are already added.
- **ADR**: offered but not yet written. The topic is a stdio `--mcp` mode of the app binary with approval by a native dialog from that process, chosen over an HTTP endpoint in the running app or MCP elicitation.

## Testing Decisions

- A good test checks only external behavior: the tool results an AI client sees, the Redis state afterwards, the config file contents, and the HTTP responses. It does not check internals.
- **Seam 1 — MCP server, in-process (main seam)**: connect through the SDK's in-memory transport against a real Redis (the existing `__tests__/` setup and the `test:*` Key prefix). Use a stub approver and a fake clock. Cover:
  - each read tool, including the scan cap and value truncation
  - password stripping in the Connection listing
  - each write tool's effect on Redis
  - Read-only blocks writes
  - Confirm writes with Deny, Allow once (the next write asks again) and Allow for this session (the next write skips the prompt; after 1 h it asks again)
  - plain Connections write with no prompt
  - excluded operations are not listed
  - AI activity rows for done, denied and blocked writes, no rows for reads, and no rows when the toggle is off
- **Seam 2 — client config installer**: a temp home directory. For each AI client, cover install on a missing file, install into an existing file with unrelated content (kept byte-for-byte for TOML outside our block), Installed / Stale / Not installed status, Reinstall fixing Stale, and Remove leaving other entries alone.
- **Seam 3 — AI activity routes**: route tests in the style of the existing route suites. Cover the list with the Connection filter and ordering, the toggle get/set, and the 30-day cleanup.
- **Packaged smoke**: extend the existing packaged-app smoke script to start the binary with `--mcp`, send `initialize` and assert a valid response.
- No tests for the native dialog, the panel UI or the `--mcp` boot glue in the Electron main module.

## Out of Scope

- MCP in web and Docker setups, and any HTTP/SSE MCP transport.
- MCP elicitation as the approval path.
- AI clients beyond Claude Desktop, Claude Code, Codex and Cursor (Manual setup covers the rest by hand).
- Flush, bulk delete by Key pattern, Connection management and generic command execution over MCP.
- Logging reads in AI activity.
- A per-Connection "expose to MCP" toggle.
- Typed-name confirmation in the approval dialog.
- Windows config paths (Windows is out of scope for the Desktop app).

## Further Notes

- Follows the Tabularis design (tabularis.dev/wiki/mcp-server): the app binary in `--mcp` mode over stdio, with one-click config writing per AI client.
- AI clients must be restarted after install to pick up the server. The panel says so.
- Claude Desktop and Cursor keep one `--mcp` process alive for as long as the AI client runs. That is why the session grant has a 1 h cap.
- Working agreements apply: yarn only, no commits (stage new files with `git add`), and writes go through the guard rules above.
