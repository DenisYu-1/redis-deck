# Cluster scan performance: spec

Goal: make Key search, Page meta and bulk operations fast and safe on large and clustered Connections, **without changing transport**. Vocabulary: `/GLOSSARY.md` (Node, Scan cursor set, Page meta). Decision: `docs/adr/0002-redis-cli-only-transport-on-clusters.md`. Use yarn. Do not commit; stage new files only.

## Constraint

On clustered Connections every Redis call goes through `redis-cli`. The persistent node-redis client stays limited to non-clustered Connections (ADR 0002). Work cuts `redis-cli` spawns; it does not replace them.

## Today (measured from code)

- Cluster Page meta: 3 `redis-cli` spawns per Key (`services/keyMeta.js` `fetchCluster`): about 150 for a 50-Key page.
- `scanClusterNodes` scans Nodes sequentially, one spawn per Node per hop, and re-resolves `CLUSTER NODES` every call.
- A failed Node scan is logged and its cursor reset to `0`: its Keys are silently lost and the UI thinks the scan finished.
- `GET /keys` loops up to 60 SCAN hops in one blocking request.
- `GET /allkeys`, `DELETE /allkeys` and export hold the full result in memory.
- `MEMORY USAGE` runs for every Key of every page.

## Requirements

### R1. Batched Page meta per Node (clustered)
- Group a page's Keys by the Node whose SCAN returned them. Send each Node's TYPE / TTL / MEMORY commands through **one** `redis-cli --json` stdin session. `--json` over stdin prints one line per reply (`null` for nil), so replies align one-to-one with commands; no marker commands needed.
- No MOVED handling on this path: the owner is known. If a Key was moved by a reshard (reply is a MOVED error), retry that Key once through the existing owner-discovery path.
- `GET /keys` returns each Key's Node id alongside its meta.

### R2. Parallel Node scans
- Scan Nodes concurrently with `Promise.all`, at most **4** `redis-cli` processes at once per Connection (constant).
- The Scan cursor set stays one cursor per Node; its order and shape do not change.

### R3. Topology cache
- Cache `CLUSTER NODES` for **30 s** per Connection. Drop the entry on connection-refused or MOVED errors and when the Connection is edited or deleted.

### R4. Lazy size (clustered Connections only)
- On clustered Connections `GET /keys` returns type and TTL but no size; the Size column shows a placeholder.
- New `POST /keys/sizes` takes `{ env, keys: [{ key, node }] }` and returns sizes, using one batched `redis-cli --json` call per Node. The client requests sizes for visible rows only.
- Non-clustered Connections keep returning size inline (the pipelined persistent socket is already cheap).

### R5. Deep search responsiveness
- Replace `MAX_ITERATIONS = 60` with a per-request **time budget of 2 s**. When it runs out the response is partial: `hasMore: true`, the current Scan cursor set, and scan stats (`iterations`, `returned`, `matched`, `ms`).
- The client continues automatically and shows "scanned N…". No SSE or websockets; the server stays stateless.

### R6. Node failure is visible and resumable
- A Node whose scan fails keeps its previous cursor (not reset to `0`). The response includes `failedNodes: [{ id, error }]`.
- The UI shows a warning banner naming the failed Nodes; the next continue/retry resumes them.

### R7. Bulk operations as in-memory jobs
- Bulk delete and export become server jobs: `{ id, kind, progress, state }`, processing one scan page at a time (constant memory), pollable, cancellable. Lost on restart (no persistence).
- Creating a job goes through `writeGuard` where the operation writes. `/allkeys` is removed if nothing in the client needs it.
- Existing `MAX_EXPORT` cap stays.

### R8. Load budgets by Tier
Constants in code, keyed by the Connection's Tier. No new setting.

| Tier | Pause between SCAN hops | Max COUNT per hop |
|---|---|---|
| local | none | 20,000 |
| staging | 5 ms | 20,000 |
| production | 20 ms | 5,000 |

Applies to every scan loop (search and jobs).

## Acceptance

- One clustered Keys page of 50 Keys makes **at most one `redis-cli` spawn per Node** for Page meta (hard criterion). Wall time is reported, not gated.
- Results on the same data are identical to the old path (keys, types, TTLs; sizes once fetched).
- A killed Node produces `failedNodes` and a cursor that resumes it; other Nodes' Keys are still returned.

## Tests

Backend tests use a real Redis as today. Add an **opt-in cluster suite**, run only when `REDIS_TEST_CLUSTER` is set (local `localhost-cluster` on 5379). It asserts: spawn count per page <= Node count; equality with the old path; failed-Node behaviour (R6). CI is unchanged (single Redis service).

## Out of scope / deferred

- Reading from replicas ("scan from replicas"): deferred, not needed now.
- Replacing `redis-cli` on any path (ADR 0002).
- Persisted jobs, SSE/streaming, user-configurable throttling.

## Suggested order

1. R3 (topology cache) and R2 (parallel scans), smallest and independent.
2. R6 (failure visibility), since parallel scans make it more exposed.
3. R1 (batched Page meta) then R4 (lazy size).
4. R5 (time budget) with R8 (Tier budgets).
5. R7 (jobs).
