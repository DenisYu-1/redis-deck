# 01: Fresh database starts at data version 1 through the migration runner

**What to build:** A fresh data folder gets a local database at data version 1, created by an ordered, numbered migration runner instead of the old per-start table inspection and column patching. This is the prefactor: the legacy patching code is deleted. Version 1 is today's schema as plain `CREATE TABLE` statements. Restarting on an up-to-date database changes nothing. The web app, Docker and Desktop app all start as before.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The data version is stored in the database's own version pragma; no separate version table
- [ ] Migrations are ordered single-purpose modules; the runner applies pending ones in order, once each, bumping the version after each
- [ ] A fresh file ends at version 1 with exactly today's tables, and no backup is made
- [ ] Restarting on an up-to-date file changes nothing and makes no backup
- [ ] The legacy table-inspection, `ALTER TABLE` and rebuild code is deleted
- [ ] Tests (real temp SQLite files, through the database module, no mocks) cover fresh and up-to-date files
- [ ] `yarn test`, type-check and lint on touched files pass
