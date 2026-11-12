# 12: Workflows

**What to build:** A Plugin can declare Workflows; the user fills a validated form, dry-runs, runs, and sees history. Spec §8. ADR 0001.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Plugin config accepts an `actions` manifest (inputs: int/uuid/select, required, default, hint)
- [ ] `GET /api/workflows`, `POST /api/workflows/:id/plan`, `POST /api/workflows/:id/run`; handlers loaded from the server-side workflows directory (private extensions dir gitignored)
- [ ] `writes:true` actions blocked on Read-only and confirm-aware via the write guard
- [ ] Run history stored in SQLite and shown per action (input, connection, Tier, time, result)
- [ ] Sidebar Workflows group (plugins → actions) shown only when actions exist; route `/workflows/:actionId`
- [ ] One trivial built-in example handler; backend tests for plan/run/history/guard
- [ ] Legacy plugin components still load
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): dry run then run the example action; history row appears; blocked on a Read-only Connection
