# 05: Keys list

**What to build:** The user searches Keys by pattern, filters by type and TTL, and browses them as a virtualized tree or flat list with real scan stats. Spec §4.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Search bar with Redis glob, `/` shortcut, match highlighting
- [ ] Type chips use SCAN TYPE; TTL filter (any/has/none/<1h) applied server-side
- [ ] Page response includes per-key type, TTL, size (pipelined); scan line shows real scan stats
- [ ] Tree built client-side from loaded keys; folder counts labelled "loaded"; virtualized; Load more via cursors
- [ ] Unit tests for key tree, glob, TTL/bytes formatting
- [ ] Row selection state (checkbox, select-all) ready for ticket 08
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): search, type/TTL filters, tree/flat toggle, Load more and scroll a large keyspace without lag
