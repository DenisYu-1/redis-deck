# 08: Bulk selection

**What to build:** The user selects many Keys and sets a TTL, exports, or deletes them in one action. Spec §4.

**Blocked by:** 05, 02

**Status:** ready-for-agent

- [ ] Selection bar: "N selected of M matched", Clear, Set TTL, Export, Delete…
- [ ] `POST /keys/ttl` sets TTL or PERSIST for all selected (pipelined)
- [ ] `POST /keys/export` returns `[{key,type,ttl,value}]` as a downloaded JSON file; 400 above 1000 keys
- [ ] Existing bulk delete kept; all writes guarded and confirm-aware
- [ ] Backend tests incl. cap and guard
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): select keys, set TTL, export (file downloads), delete; selection bar counts are correct
