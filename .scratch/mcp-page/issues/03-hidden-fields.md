# 03: Hidden fields

**What to build:** A list of field names whose values AI clients never see, edited as chips in the **What AI clients may do** section (add with an input, remove with ×). Defaults: `password`, `token`, `secret`. The match is exact and case-insensitive on hash field names and on JSON object keys at any depth, and a matching value comes back as `●●●`. Masking runs before value truncation. PHP-serialized values are left alone.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] One global setting in SQLite with the defaults; the `--mcp` process reads it at call time
- [ ] `get_key` masks matching hash fields and nested JSON keys; non-JSON strings are unchanged
- [ ] Masking runs before truncation, so a masked value never leaks through a truncated preview
- [ ] The chips UI adds and removes names; empty names and duplicates are rejected
- [ ] MCP seam tests: hash, nested JSON, case-insensitive match, plain string; route test for get/set
