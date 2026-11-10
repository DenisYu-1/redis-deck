# 02: Connection safety model

**What to build:** A Connection carries a Tier, db number, verify-TLS, Read-only and Confirm-writes settings. The server refuses writes accordingly, and the UI shows the Tier everywhere. Spec §5. ADR 0001.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration adds Tier (default local), db, verify TLS, Read-only, Confirm writes; existing connections keep working
- [ ] CLI layer honours db and TLS-verify per connection
- [ ] Write guard on every mutating route: 403 when Read-only; 428 when Confirm writes lacks the confirm header matching the connection id
- [ ] Tier badges in the switcher; production banner states Read-only vs "type the connection name"
- [ ] Backend tests (real Redis) prove 403/428 on every write route and pass-through on reads

- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): production Connection shows banner and Tier badge in the switcher; a write on a Read-only Connection is refused and surfaced; no console errors
