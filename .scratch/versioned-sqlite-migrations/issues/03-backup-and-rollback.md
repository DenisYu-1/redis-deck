# 03: Pending upgrades are backed up and failures roll back

**What to build:** Before any pending migration runs on an existing, non-empty database, the app copies the file to a sibling named after the old data version, keeping only the latest copy per version. Each migration runs in a transaction; on failure it rolls back, leaves the version unchanged, and the app refuses to start with an error that names the backup file. An old unversioned database that already has tables fails version 1's plain `CREATE TABLE` this way, so the user can delete it and start fresh without losing data first.

**Blocked by:** 01: Fresh database starts at data version 1 through the migration runner

**Status:** done

- [x] A pending upgrade on an older versioned file creates a `.bak-v<oldVersion>` copy, overwriting any earlier backup for the same version
- [x] Only the main database file is copied; confirm WAL mode is not used so no side files are missed
- [x] A successful upgrade keeps Connections and other data intact and bumps the version
- [x] A failing migration rolls back, leaves the version unchanged, and the thrown error names the backup file
- [x] An unversioned file with tables makes loading throw via the failed-migration path, with the data untouched and a backup present
- [x] Tests build the previous-version fixture inside the test (no committed binary) and cover: successful upgrade, failing migration, unversioned legacy file
- [x] `yarn test`, type-check and lint on touched files pass
