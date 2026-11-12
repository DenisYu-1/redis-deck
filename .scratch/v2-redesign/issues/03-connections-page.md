# 03: Connections page rebuild

**What to build:** The user manages Connections in a master-detail page with every new field, URI paste, Test connection, import/export and reorder. Spec §5.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] List + form: name, Tier, host, port, db, user, password, URI paste, TLS, verify TLS, cluster, Read-only, Confirm writes
- [ ] URI parser (unit-tested) fills the form
- [ ] Test connection works for unsaved and saved Connections
- [ ] Passwords never sent to the client; masked placeholder; blank on save keeps existing
- [ ] Import/export JSON and drag-reorder preserved; export endpoint checked for password leakage and fixed or documented
- [ ] Old Settings page removed
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): create, edit, test, reorder and delete a Connection; URI paste fills the form; password field stays masked
