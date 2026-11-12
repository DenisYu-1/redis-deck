# 02: Failed Node is visible and resumable

**What to build:** When one Node of a clustered Connection fails during a search, the user sees a warning naming it, no Keys are silently lost, and the next continue retries that Node from where it stopped. Today its cursor is reset to 0 and the UI believes the scan finished.

**Blocked by:** 01

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Search response lists failed Nodes with their error
- [ ] A failed Node keeps its previous cursor in the Scan cursor set so a retry resumes it
- [ ] Keys from healthy Nodes are still returned
- [ ] Keys page shows a warning banner naming failed Nodes
- [ ] Cluster suite covers a stopped Node: failed Node reported, cursor resumes after it returns
