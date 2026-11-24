# 07: Log card: filters, clear, live, Connected clients

**What to build:** The rest of the AI activity card:

- a text filter (matches tool, Key and Connection), status buttons (All / OK / Denied / Blocked / Error) and a client select
- a call count summary ("N calls · N blocked · N errors")
- "Show 25 more"
- Clear, behind a confirm modal, which deletes every entry
- a refresh every 5 s while the page is open, with new rows briefly highlighted
- a "Live" marker that reads "Logging off" when the log switch is off

The **MCP server** card gets a **Connected clients** list built from AI activity: each client's label, "last call N min ago", and a green dot when the last call was less than 1 h ago.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] List route supports text, status and client filters with paging, newest first
- [ ] Clients route returns each distinct client with its last-call time; Clear route deletes all entries
- [ ] Filters, Show more, the Clear modal, polling with the highlight, and the Live / Logging off marker work on the page
- [ ] Connected clients shows "No AI clients yet." when the log is empty
- [ ] Route tests for the filters, clients and clear
