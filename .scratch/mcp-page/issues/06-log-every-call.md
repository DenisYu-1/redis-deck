# 06: Log every call

**What to build:** **AI activity** records every call an AI client makes, reads included. Each entry stores:
- time, client label, Connection and tool
- the request args and the response (capped at about 4 KB), both masked with the hidden field list
- the duration in ms
- a status: OK, Denied, Blocked or Error

The client label is the initialize `clientInfo.name`, mapped to Claude Desktop, Claude Code, Codex or Cursor; unknown clients show the raw name. Refused reads from 02 and 04 are now logged as blocked. The log card shows the columns Time · Client · Tool · Connection · Arguments · Result · Took. Clicking a row expands it to show the request and response JSON. Logging stays behind the "Log AI operations" switch (on by default), with 30-day retention.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Versioned migration adds args, response and duration; old `done` / `failed` rows become `ok` / `error`
- [ ] Reads, writes and refusals are all logged; a failed log write never fails the tool call
- [ ] Hidden field values never reach the stored args or response; responses are capped
- [ ] Client label mapping for the four known clients, raw name otherwise
- [ ] Log card has the new columns, status pills and expandable request/response rows
- [ ] MCP seam tests (read logged with duration, masking in the log, each status, logging off); route test for the list shape
