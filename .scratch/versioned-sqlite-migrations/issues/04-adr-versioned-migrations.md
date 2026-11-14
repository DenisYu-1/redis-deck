# 04: ADR 0003: versioned SQLite migrations

**What to build:** Record the decision so a future contributor knows why the app refuses a newer database and does not patch schemas ad hoc. Follow the existing ADR format and numbering.

**Blocked by:** 02: A newer database is refused with a clear message, 03: Pending upgrades are backed up and failures roll back

**Status:** done

- [x] The ADR is added under `docs/adr/` as 0004 (0003 was already taken), covering context, the decision (version pragma plus numbered migrations, backup before upgrade, refuse on newer, roll back on failure) and the trade-off against ad-hoc patching
- [x] It reflects the behavior as actually built in tickets 01 to 03
- [x] No glossary entry is added
