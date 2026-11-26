# 02: Run many statements

**What to build:** The user runs several statements at once with Run all (⌘/Ctrl+Shift+Enter) or picks them in the Choose statements… checklist popup. Statements run in order, one at a time, with no transaction. The results pane gets an Output tab with a history of `[time] conn> command → summary` and one tab for each statement run.

**Blocked by:** 01

**Status:** done

- [x] Lines that start with `#`, `--` or `//` are skipped, and so are empty lines
- [x] Run all and Choose statements… run the expected statements in order
- [x] Execution stops at the first error; later statements get a Not run result
- [x] The Output line reads "stopped at line N"
- [x] The Output history is kept in memory only
- [x] Route test for stop on error with Not run results
