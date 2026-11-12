# 06: Lazy size on clustered Connections

**What to build:** On a clustered Connection the Keys list loads without sizes and shows a placeholder in the Size column. The client then requests sizes for the visible rows only and fills them in. Non-clustered Connections keep returning size inline.

**Blocked by:** 05

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Clustered search response omits size; type and TTL still present
- [ ] New sizes endpoint takes Keys with their Node ids and answers with one batched call per Node
- [ ] Size column shows a placeholder, then fills for visible rows; scrolling fills newly visible rows
- [ ] Non-clustered Connections show size inline exactly as before
- [ ] Cluster suite covers the sizes endpoint including a missing Key
