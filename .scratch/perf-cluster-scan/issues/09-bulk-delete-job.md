# 09: Bulk delete job

**What to build:** Bulk delete on a pattern or selection runs as a server-side in-memory job that processes one scan page at a time, so memory stays constant. The user sees progress, can cancel, and can poll after navigating. Write guard applies when the job is created; jobs are lost on restart.

**Blocked by:** 07

**Status:** done

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [x] Job registry with id, progress, state, cancel and polling
- [x] Delete job scans page by page using the Tier load budgets and always against primaries
- [x] Read-only and Confirm-writes Connections are enforced at job creation
- [x] Keys page shows progress and a cancel control for the running job
- [x] Cancel stops further deletions; already deleted Keys are reported

**Done:** `services/jobs.js` is a generic in-memory registry (`{ id, kind, env, state, progress, error?, startedAt, finishedAt? }`; finished jobs pruned after 1 h or beyond 50). `services/deleteJob.js` and `routes/jobs.js`: `POST /api/jobs/delete?env=` (writeGuard; body `{ pattern, type? }` or `{ keys }`; 202), `GET /api/jobs?env=&kind=`, `GET /api/jobs/:id`, `POST /api/jobs/:id/cancel`. Clustered pages are UNLINKed with one `execArgvBatch` per primary that returned the Keys (`keyNodes`). A failed Node fails the job with `failedNodes` (no retry loop). Keys page: "Delete all matching…" in the footer with a progress and Cancel banner. Deleting a selection from the selection bar stays synchronous (bounded by loaded Keys); the API also accepts `{ keys }`.
