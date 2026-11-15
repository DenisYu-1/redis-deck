# 02: Failed Node is visible and resumable

**What to build:** When one Node of a clustered Connection fails during a search, the user sees a warning naming it, no Keys are silently lost, and the next continue retries that Node from where it stopped. Today its cursor is reset to 0 and the UI believes the scan finished.

**Blocked by:** 01

**Status:** done

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [x] Search response lists failed Nodes with their error
- [x] A failed Node keeps its previous cursor in the Scan cursor set so a retry resumes it
- [x] Keys from healthy Nodes are still returned
- [x] Keys page shows a warning banner naming failed Nodes
- [x] Cluster suite covers a stopped Node: failed Node reported, cursor resumes after it returns

**Implementation notes:**

- The Scan cursor set stays `string[]`, but a finished Node is now `'done'` instead of `'0'`. Before, `'0'` also meant "start", so finished Nodes were rescanned and returned duplicates. `'0'` or a missing entry means "not started".
- A failed Node keeps its cursor, counts toward `hasMore`, and is reported as `failedNodes: [{ id, address, error }]`. `GET /keys` stops hopping after a hop that had a failure, so it does not retry within one request.
- A full scan cannot finish while a Node is failing: `GET` and `DELETE /allkeys` answer 502 with `failedNodes`, memory-by-pattern sampling stops, and `deleteTestKeys` throws.
