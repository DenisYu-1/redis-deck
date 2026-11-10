# RedisDeck

A web UI for browsing, editing and monitoring keys on saved Redis servers.

## Language

**Connection**:
A saved definition of one Redis server (host, port, credentials, TLS, cluster flag). Everything the UI does is scoped to the current Connection.
_Avoid_: Environment, server, instance, profile

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

**Plugin**:
An optional module that adds UI and/or Workflows to the app.

**Workflow**:
A named, form-driven action (typed inputs, validation, dry-run, run, history) provided by a Plugin.
_Avoid_: Action, command, script

**Board**:
A page of Statistics widgets for the current Connection (Overview, Memory, Queues).
_Avoid_: Dashboard
