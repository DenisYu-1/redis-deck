# 07: Tier load budgets

**What to build:** Scan loops go easy on busy servers according to the Connection's Tier: pause between SCAN hops and a cap on COUNT per hop (local: none / 20,000; staging: 5 ms / 20,000; production: 20 ms / 5,000). Values are constants in code, no new setting.

**Blocked by:** 04

**Status:** ready-for-agent

Spec: `docs/perf-cluster-scan/SPEC.md`. Constraint: `redis-cli` is the only transport on clustered Connections (ADR 0002).

- [ ] Every scan loop (search and later jobs) applies the pause and COUNT cap for the Connection's Tier
- [ ] Unit test with the Tier as input verifies pause and COUNT per Tier
- [ ] Local Tier behaviour is unchanged
- [ ] Non-clustered and clustered Connections both apply the budget
