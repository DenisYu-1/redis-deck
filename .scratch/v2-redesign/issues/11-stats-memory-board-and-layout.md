# 11: Stats: Memory board + layout editing

**What to build:** The user switches Boards and customizes which widgets show. Spec §7.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Boards group in the sidebar on `/stats`; `/stats/:board` deep-links (`overview`, `memory`)
- [ ] Memory deep-dive board composed from existing widgets
- [ ] Edit layout: remove widgets, Restore removed; persisted per Connection + Board in localStorage
- [ ] Empty-board state
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): board switch, remove/restore widget, reload page and layout persists
