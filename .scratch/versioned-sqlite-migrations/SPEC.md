Status: ready-for-agent

# Versioned local database migrations

## Problem Statement

Redis Deck keeps **Connections**, saved searches, workflow run history and stats snapshots in one local SQLite database. Today the app re-inspects the tables on every start and patches missing columns. There is no schema version, so renames, drops and type changes cannot be expressed, a bad upgrade cannot be detected, nothing is backed up before changing the file, and an older app can silently run against a newer file. A mistake here can lose the user's saved Connections and their passwords.

## Solution

The local database carries an explicit **data version**. The app owns an ordered list of numbered migrations and applies the pending ones on start, each in a transaction, after backing the file up. If the file is newer than the app, or a migration fails, the app refuses to start with a clear message instead of guessing. Legacy patching code is removed: breaking changes are acceptable because nobody depends on the old unversioned files.

## User Stories

1. As a Redis user, I want my Connections to survive app updates, so that I do not re-enter passwords.
2. As a Redis user, I want a pending upgrade to back up my database first, so that I can recover if something goes wrong.
3. As a Redis user, I want the backup named after the version it came from, so that I can tell which file to restore.
4. As a Redis user, I want only one backup kept per old version, so that copies of my stored passwords do not pile up.
5. As a Redis user, I want no backup when nothing is pending, so that a normal start does not copy my file.
6. As a Redis user, I want each upgrade step to be all-or-nothing, so that a failure never leaves a half-migrated database.
7. As a Redis user, I want a failed upgrade to leave my database at its old version, so that I can retry or restore.
8. As a Redis user, I want a failed upgrade to refuse to start and name the backup file, so that I know where my data is.
9. As a Redis user who opens an old app on a newer database, I want a clear "update the app" message, so that I do not corrupt my data.
10. As a Desktop app user, I want the refusal shown in a dialog before the app quits, so that I am not left with a window that never opens.
11. As a user of `yarn start` or Docker, I want the refusal printed in the log with a non-zero exit, so that I see it in the terminal or container logs.
12. As a first-time user, I want a new empty database created at the latest version directly, so that startup is fast and needs no backup.
13. As a user with an old unversioned database, I want the app to refuse to start with a message that names the backup, so that I can delete the file and start fresh.
14. As a user on an up-to-date database, I want startup to change nothing, so that restarts are safe.
15. As a maintainer, I want a new schema change to be one new numbered migration, so that I never touch startup logic.
16. As a maintainer, I want migrations to run in order exactly once, so that a database's history is predictable.
17. As a maintainer, I want the legacy column-patching code deleted, so that there is one way to change the schema.
18. As a maintainer, I want tests that use real temporary SQLite files, so that behavior is checked without mocks.
19. As a maintainer, I want a test that opens a database written by the previous version, so that upgrades are verified before release.
20. As a maintainer, I want the decision recorded as an ADR, so that the next contributor knows why the app refuses newer databases.
21. As a maintainer, I want the web, Docker and Desktop app flows to use the same upgrade path, so that behavior is identical everywhere.

## Implementation Decisions

- The **data version** is stored in the database's own `user_version` pragma; no separate version table.
- Migrations are an ordered list of single-purpose modules, each exposing one upgrade function that receives the open database. A small runner reads the stored version, takes the backup, applies pending migrations in order, and bumps the version after each.
- Version 1 is the current schema, written as plain `CREATE TABLE` statements (no `IF NOT EXISTS`). All existing table-inspection, `ALTER TABLE` and rebuild code in the database module is deleted.
- **Fresh file**: created at the latest version with no backup.
- **Old unversioned file with tables** (version 0, tables present): no special path. Version 1's plain `CREATE TABLE` fails because the tables exist, so the transaction rolls back and the failed-migration behavior applies. The user deletes the file. This is deliberate: least code, no users to migrate.
- **Backup**: before any pending migration, copy the database file to a sibling named with the old version (`.bak-v<N>`); overwrite any earlier backup for the same version. Only the main file is copied (WAL mode is not used; confirm while implementing). Backups are not encrypted or auto-deleted, same as the original file.
- **Failed migration**: each migration runs in a transaction; on error, roll back, leave the version unchanged, and refuse to start with an error naming the backup file.
- **Newer database** (stored version above the highest known): refuse to start with an "update the app" error. No attempt to run.
- **Refusal surface**: the database module throws a descriptive error at load. The Desktop app catches it, shows a dialog and quits. The Node server entry lets it exit non-zero with the message logged.
- **Data location** is unchanged (`DATA_DIR`, Electron per-user data folder, Docker volume).
- No schema change in this work: the data version after upgrade is 1 and the tables are exactly today's.
- ADR: add decision 0003 "Versioned SQLite migrations" covering the trade-off against ad-hoc patching and the refuse-on-newer rule. No glossary entry: migrations are implementation detail.

## Testing Decisions

- A good test checks external behavior only: the resulting data version, whether Connections are still readable, which backup file exists, and whether loading succeeds or throws with the right message. It does not inspect the runner's internals.
- **One seam**: the database module loaded fresh against a temporary data folder. The existing database service tests already use this layer with a real SQLite file and no mocks; extend them or add a sibling suite in the same style.
- Cases: fresh file; up-to-date file (no backup, no change); an older versioned file (backup created, data intact, version bumped); a newer file (throws, file untouched); a failing migration (rolls back, version unchanged, error names the backup); an old unversioned file with tables (throws, no data lost).
- The "previous version" fixture is built inside the test by running the earlier migration list, not committed as a binary. Until a version 2 exists, the fresh-file test covers the same path.
- Test files use the `test:*` conventions already in the suite; no Redis needed for these cases.
- The release workflow's Desktop smoke check is unchanged.

## Out of Scope

- Encrypting stored Connection passwords.
- Automatic cleanup or rotation of backups.
- Downgrade migrations or running an older app on a newer database.
- Any actual schema change beyond the version 1 baseline.
- Auto-update of the Desktop app.
- Changes to the stats retention (30 days) or other data lifecycles.

## Further Notes

- Vocabulary: `/GLOSSARY.md` (**Connection**, **Desktop app**). Related decisions: `docs/adr/0001-server-side-workflows-and-enforced-read-only.md`, `docs/adr/0002-redis-cli-only-transport-on-clusters.md`.
- Use yarn. Do not commit; stage new files only. Do not run repo-wide `lint:fix`; type-check and lint only the touched files.
