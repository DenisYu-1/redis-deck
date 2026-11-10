# 04: Welcome flow

**What to build:** With zero Connections, every route shows a Welcome screen with a quick-add form; saving one lands the user on Keys. Spec §6.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Welcome renders on all routes when no Connections exist
- [ ] Quick-add (name, host, port, URI, Test, Save) reuses the Connection form logic
- [ ] After save, user lands on `/keys` with that Connection selected
- [ ] Old EmptyState removed
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): with an empty connections store, all routes show Welcome; quick-add lands on /keys
