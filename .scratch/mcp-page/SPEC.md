Status: ready

# AI clients page (design `design/RedisDeck (1).html`, "AI assistant" view)

## Problem Statement

The MCP work is split across a small panel on the Connections page and a separate `/ai-activity` page. The user cannot decide, for each Connection, what AI clients may see or do. Secrets in values reach the AI client. Reads are not logged, so the user cannot see what an AI client looked at. The new design puts all of this on one page.

## Solution

A new page, **AI** (route `/ai`; the AI clients section is Desktop-only, see `.scratch/ai-assistant/SPEC.md`), in the sidebar foot below Settings. Layout follows the design:

- Left column: **What AI clients may do**, which holds the AI access grid and the hidden field names.
- Right column: an **MCP server** card with the stdio command and Connected clients, then **Tools exposed** and **Add to a client**.
- Full width below: the **AI activity** log.

Out of scope for this iteration: the built-in chat and the Model card (separate iteration), the Console page (separate iteration, needs an ADR that replaces part of ADR 0001), an HTTP transport, token, and server on/off switch, VS Code, "Install in all found", and the `run_command` / `slowlog` tools.

## Decisions

### AI access (ADR 0005)
- Each Connection has these columns: `keys`, `values`, `write`, `workflows`, `ask`. They are stored in SQLite through a versioned migration.
- **See keys** off: the Connection is missing from `list_connections`, and every tool refuses it with "not available to AI clients".
- **See values** off: `get_key` returns type, TTL and size but no value. Scan still returns Key names.
- **Write** off: the key write tools are blocked.
- **Workflows** off: `run_workflow` is blocked. `plan_workflow` stays allowed, because it only reads.
- Dependencies: `values`, `write` and `workflows` need `keys`. `ask` needs `write` or `workflows`. On a Read-only connection, `write` and `workflows` show turned off.
- **Ask before writes** is the only trigger for the native approval dialog. On a production Tier it is always on. **Confirm writes** no longer triggers the dialog.
- Defaults for a new Connection (and for existing ones in the migration):
  - `keys` on.
  - `values` off on production.
  - `write` and `workflows` on for local only, and only if the Connection is not Read-only.
  - `ask` on for every Tier except local.
- A blocked call is logged as `blocked`, with the reason.

### Hidden fields
- One global list of field names, default `password`, `token`, `secret`.
- Matching is exact and case-insensitive. It covers hash field names and JSON object keys at any depth. PHP-serialized values are not masked.
- A matching value shows as `●●●` in every tool result, and in AI activity request args and responses.
- Masking runs before value truncation and before the log is written.

### Tool switches
- One global setting per tool, stored in SQLite. Default: all on except `run_workflow`.
- A tool that is turned off drops out of `tools/list` and is refused at call time with "tool is turned off". The refusal is logged as `blocked`.
- The page lists the tools the server really registers, with a `write` tag on write tools.

### AI activity
- Every call is logged, reads included.
- Statuses: `ok`, `denied`, `blocked`, `error`. These replace `done` / `failed`; the migration maps the old rows.
- Each row stores time, client, Connection, tool, request args (masked), response (masked, capped at about 4 KB) and duration in ms.
- 30-day retention, as before. The "Log AI operations" setting stays and is on by default.
- Client label: `clientInfo.name`, mapped to Claude Desktop / Claude Code / Codex / Cursor. Unknown clients show the raw name.
- Routes:
  - list, with filters for text (tool, key, connection), status and client, paged, newest first
  - the distinct clients with their last-call time
  - clear all

### Page UI
- **MCP server card**:
  - the `<binary> --mcp` command with a Copy button
  - **Connected clients**, built from AI activity: client name, "last call N min ago", green dot if the last call was under 1 h ago
  - no status pill and no sidebar dot
- **Add to a client**: today's four clients, statuses Installed / Stale (shown as Reinstall) / Not installed, and Manual setup.
- **Log card**:
  - columns Time · Client · Tool · Connection · Arguments · Result · Took
  - rows expand to show request and response JSON
  - filters: text, status buttons (All / OK / Denied / Blocked / Error), client select
  - "Show 25 more"
  - Clear, behind a confirm modal
  - "Live" marker, which reads "Logging off" when logging is off
  - refreshes every 5 s while the page is open, and new rows are highlighted
- Remove `AiActivityControls` from the Connections page and the `/ai-activity` route and page. Their tests move to the new page.

## Testing Decisions

- **MCP seam (in-memory transport, real Redis):**
  - every AI access column, including the production "always ask" rule
  - masking in `get_key` and in the logged args and responses
  - tool switches in `tools/list` and at call time
  - reads logged with a duration
  - statuses
- **Route tests:** AI access get/set with the dependency rules, tool switches, list filters, clients, clear.
- **Page:** one RTL test per card at most. No tests for the native dialog.

## Issues

See `issues/` (01 page shell first; 02, 03, 04 in parallel; 05 after 04; 06 after 01+03; 07 after 06).
