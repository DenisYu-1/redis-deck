# 04: AI access: see Keys / see values

**What to build:** The **AI access** grid in **What AI clients may do**. It has one row per Connection, with its Tier badge, and the columns See keys, See values, Write, Workflows and Ask before writes. Every Connection, existing or new, gets the Tier defaults:
- keys on
- values off on production
- write and Workflows on for local only, and only when the Connection is not Read-only
- ask on for every Tier except local

In this ticket only the read side takes effect. **See keys** off hides the Connection from `list_connections`, and every tool refuses it with "not available to AI clients". **See values** off makes `get_key` return type, TTL and size but no value, while scans still return Key names. The other columns are saved but have no effect until 05.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Versioned migration adds AI access with the Tier defaults for existing Connections; creating a Connection gives it the defaults; deleting it removes its row
- [ ] See keys off: missing from `list_connections`; every tool on it is refused
- [ ] See values off: `get_key` has no value; `scan_keys` is unchanged
- [ ] Grid saves through a route; the server enforces "values / write / Workflows need keys"
- [ ] MCP seam tests for both columns; route tests for get/set and the dependency rule
