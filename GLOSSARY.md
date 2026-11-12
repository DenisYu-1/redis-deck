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
The page position the UI hands back to continue a Key search: one cursor per Node.
_Avoid_: Offset, page token

**Page meta**:
The type, TTL and size shown on each Key row of a result page.
_Avoid_: Key info, row data

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

**Plugin**:
An optional module that adds UI and/or Workflows to the app.

**Workflow**:
A named, form-driven action (typed inputs, validation, dry-run, run, history) provided by a Plugin.
_Avoid_: Action, command, script

**Board**:
A page of Statistics widgets for the current Connection (Overview, Memory, Queues).
_Avoid_: Dashboard
