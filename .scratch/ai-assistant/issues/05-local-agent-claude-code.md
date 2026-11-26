# 05: Local agent: Claude Code

**What to build:** The Model card gains the **Local agent** mode with Claude Code (`claude`), shown as found (with its path) or missing. Lookup searches PATH plus `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin` and `~/.npm-global/bin`. There is an optional path field and an editable Arguments field that warns changing it can give the agent access to the host, plus a Docker note that the CLI must exist inside the container. The agent uses its own login. Default arguments limit it to our tools:

`-p --strict-mcp-config --mcp-config {mcp_config} --allowedTools "mcp__redis-deck__*" --disallowedTools Bash,Edit,Write,Read,WebFetch`

For each turn the backend creates a random token and a temp `{mcp_config}` file pointing at an internal Streamable HTTP MCP endpoint, bound to 127.0.0.1, which accepts only that token and is never shown to external AI clients. Both are removed when the turn ends. Answer text streams from stdout as plain text, rendered as markdown. Tool-call rows and approval cards come from our endpoint, never from parsing CLI output. **Test** runs one real turn asking the agent to list its redis-deck tools and reports "answered in N s, listed N tools".

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A chat turn through the agent behaves like API key mode: rows, approval cards, AI access, logging
- [ ] Endpoint refuses a wrong or expired token and is reachable only on 127.0.0.1
- [ ] After 20 tool calls the endpoint refuses more and the turn stops with the spec message
- [ ] Token, temp file and agent process are cleaned up when the turn ends, fails or is cancelled
- [ ] Missing CLI and agent errors show a readable message
- [ ] Turn runner tests with a fake agent process; lookup test with a temp home and fake binaries
