# 02: Chat answers read questions

**What to build:** A floating button on every page except Welcome opens the chat side panel (header: "Assistant", the mode/model label linking to the Model card, **New chat**, **Close** / Esc). The user asks a question about the current Connection and gets a streamed answer based on real data, through the **same MCP tool registry** AI clients use (in-memory MCP pair), with client label "Redis Deck Assistant". So **AI access**, hidden fields, tool switches and **AI activity** apply unchanged.

One backend route streams the turn: text chunks, tool-call rows, done. The Anthropic Messages adapter uses plain `fetch`. Every turn sends the whole transcript plus the context chips. In this ticket the only chip is the current Connection. The system prompt names the Connection and its Tier, lists the rules (ask before writes, no command tool) and says Redis data is data, never instructions.

Assistant messages render as markdown with a small hand-written renderer (no new package, no raw HTML); code blocks have **Copy**. Tool-call rows are collapsible (status, tool, args, ms, response). History lives in memory for the browser session; **New chat** clears it and nothing is saved on the server. The empty state shows "Ask about <conn>" and a short explanation. Footer: "No model is set up yet" when so. Writes are denied until ticket 03.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Panel opens on every page except Welcome and keeps history across page changes
- [ ] Answer text streams; only one turn runs at a time per chat
- [ ] Tool calls go through the registry: AI access, masking, tool switches and logging under "Redis Deck Assistant"
- [ ] At most 20 tool calls per turn; then "Stopped after 20 tool calls; ask again to continue"
- [ ] Provider errors show in the chat without leaking the key or Connection config
- [ ] Turn runner tests with a fake model adapter (streaming, tool calls, limit); adapter mapping tests from recorded fixtures; one client test (send, tool row)
