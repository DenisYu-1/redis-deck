# 08: Time-budgeted search with auto-continue

**What to build:** A search that cannot fill a page quickly no longer blocks: each request stops after about 2 seconds and returns a partial result with the Scan cursor set, hasMore and scan stats. The Keys page continues automatically and shows how many Keys have been scanned so far. Replaces the 60-iteration cap.

**Blocked by:** 04, 07

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Request stops after the 2 s budget and returns hasMore with a valid cursor set and stats
- [ ] Client auto-continues until the page fills or the scan ends, showing a scanned-count progress
- [ ] User can stop an in-progress search
- [ ] Rare pattern on a large keyspace eventually completes with no keys lost or duplicated across continues
