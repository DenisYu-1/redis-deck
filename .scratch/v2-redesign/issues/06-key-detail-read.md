# 06: Key detail (read)

**What to build:** Selecting a Key shows its metadata, values and a decoding inspector. Spec §4.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `GET /keys/:key/meta` returns encoding, idle, memory, length (backend test)
- [ ] Header: type badge, name with muted prefix, TTL, Memory, Encoding, Length, Idle; copy-name and reload
- [ ] Tables for hash, list, set (members only), zset (score + date hint); stream/json read-only raw; field/item filter
- [ ] Inspector with Auto/Raw/JSON/PHP decode, Copy; decoders unit-tested
- [ ] Old keysManager read-path code migrated, not duplicated
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): open one key of each type; inspector decodes JSON and PHP-serialized values; meta values populate
