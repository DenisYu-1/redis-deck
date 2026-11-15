# 03: Topology cache

**What to build:** Repeated searches on a clustered Connection stop re-resolving the Node list: it is cached for 30 seconds per Connection, dropped on connection-refused or MOVED errors, and when the Connection is edited or deleted.

**Blocked by:** 01

**Status:** done

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [x] Topology is resolved at most once per 30 s per Connection under repeated searches (verified via spawn count)
- [x] Cache entry is dropped on connection-refused and MOVED errors
- [x] Cache entry is dropped when the Connection is edited or deleted
- [x] Non-clustered Connections are unaffected
