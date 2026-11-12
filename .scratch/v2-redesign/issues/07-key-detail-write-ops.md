# 07: Key detail (write operations)

**What to build:** The user can change Keys from the detail pane, with Read-only and Confirm writes respected. Spec §4, §5.

**Blocked by:** 06, 02

**Status:** ready-for-agent

- [ ] Rename, copy-to-name, TTL edit, delete, edit string value, add hash field, zadd
- [ ] "New key" modal replaces the old add-key panel
- [ ] Controls disabled with an explanatory title on Read-only Connections; server 403 surfaces as a toast
- [ ] Confirm writes prompts for the connection name and sends the confirm header
- [ ] List and detail refresh after each operation
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): run each write op on a test key; Read-only disables controls; Confirm writes prompts for the name
