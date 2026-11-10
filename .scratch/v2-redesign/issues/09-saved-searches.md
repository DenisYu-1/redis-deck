# 09: Saved searches

**What to build:** The user saves a Key pattern per Connection and re-runs it from the sidebar. Spec §4.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Storage for name + pattern per Connection; list/create/delete API
- [ ] Sidebar group on the Keys route with "+" to save the current pattern; click applies it
- [ ] Production badge derived from the Connection Tier, not stored
- [ ] Deleting a Connection removes its saved searches
- [ ] Backend tests
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): save, apply and delete a search; list switches when changing Connection
