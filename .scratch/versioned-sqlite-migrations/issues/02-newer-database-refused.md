# 02: A newer database is refused with a clear message

**What to build:** If the stored data version is higher than the app knows, the app refuses to start with an "update the app" message and never touches the file. The Desktop app shows the message in a dialog and quits. The Node server and Docker print it to the log and exit non-zero.

**Blocked by:** 01: Fresh database starts at data version 1 through the migration runner

**Status:** ready-for-agent

- [ ] Loading the database module against a newer file throws a descriptive error mentioning the need to update
- [ ] The newer file is left byte-for-byte untouched and no backup is made
- [ ] The Desktop app shows the error in a dialog before quitting
- [ ] `yarn start` and Docker log the error and exit with a non-zero code
- [ ] Tests cover the throw and the untouched file
