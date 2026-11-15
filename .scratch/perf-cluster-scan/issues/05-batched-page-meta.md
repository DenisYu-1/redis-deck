# 05: Batched Page meta per Node

**What to build:** Page meta (type, TTL, size) on a clustered Connection is fetched with one batched redis-cli session per Node instead of three spawns per Key. Each Key in the search response carries the Node it came from, so no owner lookup or MOVED handling is needed on the normal path.

**Blocked by:** 04

**Status:** done

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [x] Search response includes the Node id for every Key
- [x] Page meta uses one redis-cli --json stdin session per Node; replies align one-to-one with commands, nil replies included
- [x] A Key moved by a reshard is retried once through the existing owner-discovery path
- [x] Cluster suite: at most one spawn per Node for Page meta of a 50-Key page, and results equal to the old path
