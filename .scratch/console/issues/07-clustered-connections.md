# 07: Clustered Connections

**What to build:** The Console works on clustered Connections through `redis-cli -c` (ADR 0002), under the per-Connection spawn cap. Replies have the same shapes as on standalone Connections. `-c` redirects only commands that have a Key, so commands without one (SCAN, KEYS, DBSIZE, RANDOMKEY, INFO, SLOWLOG GET, CLIENT LIST and the like) run on one Node, and the result names that Node. No fan-out across Nodes.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Reads and writes run on a clustered Connection, with redirects followed
- [ ] Every spawn counts against the per-Connection cap
- [ ] Reply shapes match standalone Connections, including pair replies and nil
- [ ] A result from a command without a Key names the Node that answered
- [ ] SCAN continuation goes to the same Node as the first SCAN
- [ ] Error text is scrubbed of Connection config
- [ ] A cluster run is tested when `REDIS_TEST_CLUSTER` is set
