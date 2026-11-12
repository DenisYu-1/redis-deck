# 01: Cluster test harness and spawn counter

**What to build:** A way to count redis-cli spawns per request, and an opt-in cluster test suite (runs only when REDIS_TEST_CLUSTER is set, against the local cluster) that records today's baseline: spawns for one 50-Key page of Keys and the results later tickets must match. CI stays unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Spawns per request can be counted in tests without changing production behaviour
- [ ] Opt-in suite is skipped when REDIS_TEST_CLUSTER is unset and passes against the local cluster when set
- [ ] Baseline spawn count and expected Keys/types/TTLs for a page are asserted or recorded
- [ ] yarn test and CI stay green with no cluster available
