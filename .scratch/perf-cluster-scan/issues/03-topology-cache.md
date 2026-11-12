# 03: Topology cache

**What to build:** Repeated searches on a clustered Connection stop re-resolving the Node list: it is cached for 30 seconds per Connection, dropped on connection-refused or MOVED errors, and when the Connection is edited or deleted.

**Blocked by:** 01

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Topology is resolved at most once per 30 s per Connection under repeated searches (verified via spawn count)
- [ ] Cache entry is dropped on connection-refused and MOVED errors
- [ ] Cache entry is dropped when the Connection is edited or deleted
- [ ] Non-clustered Connections are unaffected
