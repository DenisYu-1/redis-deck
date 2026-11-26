# 03: Writes through the write guard

**What to build:** The write commands from the spec (SET, HSET, HDEL, LPUSH, RPUSH, DEL, UNLINK, EXPIRE, PERSIST, RENAME, INCR) join the allowed list. If a batch has any write, the server runs the write guard once for the whole batch. On Read-only nothing runs. On Confirm writes the UI shows the design's modal that lists the writes ("Run N writes on <conn>?") and retries with the confirmation.

**Blocked by:** 02

**Status:** done

- [x] A batch with a write on a Read-only Connection answers 403 and no statement runs, reads included
- [x] A batch with a write on a Confirm writes Connection answers 428 and no statement runs
- [x] The modal lists the writes; on production the user must type the Connection name
- [x] The client retries with the confirmation and the batch runs; cancel runs nothing
- [x] A read-only batch needs no confirmation on any Connection
- [x] Writes that ran before a later error stay applied
- [x] Route tests: 403, 428, confirmed retry
