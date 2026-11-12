# 09: Bulk delete job

**What to build:** Bulk delete on a pattern or selection runs as a server-side in-memory job that processes one scan page at a time, so memory stays constant. The user sees progress, can cancel, and can poll after navigating. Write guard applies when the job is created; jobs are lost on restart.

**Blocked by:** 07

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Job registry with id, progress, state, cancel and polling
- [ ] Delete job scans page by page using the Tier load budgets and always against primaries
- [ ] Read-only and Confirm-writes Connections are enforced at job creation
- [ ] Keys page shows progress and a cancel control for the running job
- [ ] Cancel stops further deletions; already deleted Keys are reported
