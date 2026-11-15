# 04: Parallel Node scans

**What to build:** Searches on a clustered Connection scan all Nodes concurrently, with at most 4 redis-cli processes running at once per Connection. Results and the Scan cursor set keep their current order and shape.

**Blocked by:** 02, 03

**Status:** done

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [x] Nodes are scanned concurrently with a cap of 4 processes per Connection
- [x] Cursor set order and shape are unchanged; Load More resumes correctly
- [x] Cluster suite shows the same Keys as the sequential path on the same data
- [x] Failure handling from the failed-Node ticket still holds under concurrency
