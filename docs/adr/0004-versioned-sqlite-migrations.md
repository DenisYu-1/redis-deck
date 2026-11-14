# Versioned SQLite migrations

The local SQLite database stores its data version in its own `user_version` pragma. The app has an ordered list of numbered migrations (`services/migrations/`). On every start, `services/migrate.js` applies the pending migrations in order.

Before, the app looked at the tables on each start and added missing columns. That approach cannot rename, drop or change the type of a column. It cannot detect a bad upgrade. It made no backup. And an older app could run against a newer file without noticing. The database holds the user's Connections and their passwords, so a silent mistake loses real data.

Decision:

- Before running any pending migration on a non-empty file, the app copies the main file to `<file>.bak-v<oldVersion>`. A newer backup of the same version replaces the older one. WAL is not used, so the main file is the whole database. A fresh file, or a file that is already at the latest version, gets no backup.
- Each migration and its version bump run in one transaction. If a migration fails, the transaction rolls back, the version stays the same, and the app refuses to start with an error that names the backup.
- If the stored version is higher than the app knows, the app refuses to start and tells the user to update it. The file is not changed. Downgrade migrations are not supported.
- Version 1 is the schema as it was when this decision was made, written as plain `CREATE TABLE`. A database from before versioning (version 0 with tables) makes version 1 fail. The user deletes the file and starts again. This is deliberate: nobody depends on those old files, so no code is written to convert them.
- How the refusal reaches the user: the database module throws when it loads. The Desktop app shows the error in a dialog and quits. `node server.js`, and so Docker, logs the error and exits with a non-zero code.

Consequences: a schema change is one new module added to the end of the list. Old migrations are never edited. Startup logic does not change. Users who run an older build on a newer file must update the app. Backups are not encrypted and are not deleted automatically, the same as the database file.
