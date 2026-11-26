# RedisDeck

A web UI for browsing, editing and monitoring keys on saved Redis servers.

## Language

**Connection**:
A saved definition of one Redis server (host, port, credentials, TLS, cluster flag). Everything the UI does is scoped to the current Connection.
_Avoid_: Environment, server, instance, profile

**Node**:
One Redis server inside a clustered Connection, holding a share of the Keys. A non-clustered Connection has exactly one.
_Avoid_: Shard, master, instance

**Scan cursor set**:
The page position the UI hands back to continue a Key search: one cursor per Node, in Node id order. `'0'` means the Node's scan has not started; `'done'` marks a Node that has finished (SCAN itself uses `0` for both).
_Avoid_: Offset, page token

**Page meta**:
The type, TTL and size shown on each Key row of a result page. On a clustered Connection it is type, TTL and the Node holding the Key; the size is fetched later, only for the rows on screen.
_Avoid_: Key info, row data

**Job**:
A bulk operation (delete or export) running on the server, in memory: an id, a kind, progress counters and a state (`running`, `done`, `cancelled`, `failed`). The UI polls it and can cancel it. Jobs are lost when the server restarts.
_Avoid_: Task, background process

**Tier**:
A label on a Connection saying how dangerous it is: `local`, `staging` or `production`. Shown as a badge.
_Avoid_: Environment, env, stage

**Read-only connection**:
A Connection that rejects every write, delete and write-Workflow.
_Avoid_: Locked, protected

**Confirm writes**:
A Connection setting that makes the user type the Connection name before a write goes through.
_Avoid_: Safe mode, double confirm

**Key**:
A single Redis key with its type, TTL, size and value.

**Key pattern**:
A Redis glob (`*`, `?`, `[abc]`) used to match Keys.
_Avoid_: Query, filter

**Saved search**:
A named Key pattern the user can re-run from the sidebar.

**Desktop app**:
The app installed and run as a regular program on the user's computer, without a separate server to start.
_Avoid_: Native app, standalone, client

**AI client**:
An external AI program (Claude Desktop, Claude Code, Codex, Cursor, Pi) that uses Redis Deck's Connections through MCP.
_Avoid_: Agent, assistant, integration

**AI assistant**:
The chat built into Redis Deck that answers questions about a Connection through the same tools AI clients use.
_Avoid_: Agent, bot, copilot

**AI access**:
Per-Connection rules for what AI clients and the AI assistant may see and do: see Keys, see values, write, run Workflows, ask before writes.
_Avoid_: Permissions, policy, ACL

**AI activity**:
The record of calls AI clients and the AI assistant made or attempted on Connections.
_Avoid_: Audit log, history

**Plugin**:
A named bundle of Workflows, defined by a manifest and server-side handlers.

**External Plugin**:
A Plugin loaded from the user's data folder instead of shipped inside the app.

**Workflow**:
A named, form-driven action (typed inputs, validation, dry-run, run, history) provided by a Plugin.
_Avoid_: Action, command, script

**Board**:
A page of Statistics widgets for the current Connection (Overview, Memory deep-dive).
_Avoid_: Dashboard
