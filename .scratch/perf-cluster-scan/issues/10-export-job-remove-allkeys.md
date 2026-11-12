# 10: Export job and /allkeys removal

**What to build:** Export runs on the same job registry with the existing MAX_EXPORT cap and the user can download the result when finished. The unbounded all-keys endpoint is removed if nothing in the client still needs it.

**Blocked by:** 09

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Export runs as a job with progress and cancel; result downloadable on completion
- [ ] MAX_EXPORT cap still enforced
- [ ] The all-keys GET endpoint is removed, or kept with a documented caller if one remains
- [ ] Tests cover export of a large pattern without loading all Keys into memory at once
