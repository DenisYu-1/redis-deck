# 10: Stats: Overview board

**What to build:** The Statistics page in the new look with tiles, time ranges, Live polling and the Overview board. Spec §7.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Header with caption "Snapshots every 5 min · 30-day retention", ranges 1h/6h/24h/7d/30d from history
- [ ] Tiles: Ops/sec, Memory, Hit rate (warn <90, crit <75), Clients, CPU, Keys with sparklines
- [ ] Live/Paused polls realtime every 10 s, updating tile values and sparkline tail only
- [ ] Existing widgets (memory chart, keyspace, commands, slowlog, memory-by-pattern) restyled; chart crosshair + tooltip
- [ ] Out-of-scope items (widget builder, Latency, Queues, 15m) absent
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): tiles and charts render with real data; range switch and Live/Paused work; tooltip follows the pointer
