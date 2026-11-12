# Server-side workflow handlers and backend-enforced read-only

Workflows (plugin actions) run as handler modules on the Express server, and Read-only / Confirm-writes are enforced in Express guards, not in the UI.

The old plugin system was frontend-only: React components calling generic key endpoints. The v2 design adds Workflows with typed inputs, dry-run plans and run history, and Connections that must refuse writes. Alternatives considered: (a) frontend-only plugins composing existing endpoints, (b) a generic "run these commands" endpoint (today's `/api/custom/execute`). Both leave safety to the browser, so any client (or a plugin bug) can write to a production Connection, and neither can produce a trustworthy dry-run or audit history.

Consequences: a plugin that needs a Workflow must ship a server module (`services/workflows/<pluginId>/<actionId>.js` exporting `plan` and `run`); private ones live in the gitignored `services/workflows/extensions/`. Moving back to frontend-only would drop enforcement and history, so this is costly to reverse. `/api/custom/execute` is superseded and should be removed once nothing depends on it.
