# 04: ADR 0003: versioned SQLite migrations

**What to build:** Record the decision so a future contributor knows why the app refuses a newer database and does not patch schemas ad hoc. Follow the existing ADR format and numbering.

**Blocked by:** 02: A newer database is refused with a clear message, 03: Pending upgrades are backed up and failures roll back

**Status:** ready-for-agent

- [ ] The ADR is added under `docs/adr/` as 0003, covering context, the decision (version pragma plus numbered migrations, backup before upgrade, refuse on newer, roll back on failure) and the trade-off against ad-hoc patching
- [ ] It reflects the behavior as actually built in tickets 01 to 03
- [ ] No glossary entry is added
