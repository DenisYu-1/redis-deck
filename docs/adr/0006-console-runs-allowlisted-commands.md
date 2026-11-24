# The Console runs commands from a fixed allowed list, for people only

ADR 0001 removed generic command execution (`/api/custom/execute`), because it left safety to the browser. The Console brings back typed Redis commands, but only for people in the app, and on these terms:

- The server accepts only commands on a fixed allowed list. Each command on it is marked read or write.
- Every write goes through the write guard: Read-only refuses it, and Confirm writes needs the typed confirmation.
- Commands that can wipe or stall a server are never on the list: FLUSHDB, FLUSHALL, CONFIG SET, SHUTDOWN, DEBUG, MONITOR, SUBSCRIBE.

AI clients and the AI assistant get no command tool. They use the named MCP tools only.

We considered allowing every command except a block list, and telling writes apart by the `write` flag from `COMMAND INFO`. We rejected it: one missed entry would open a dangerous command, and the result view needs to know each command's reply shape anyway.

This replaces the "no generic command execution" part of ADR 0001 for the Console only. Adding a command is one entry on the list.
