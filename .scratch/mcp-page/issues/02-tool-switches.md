# 02: Tool switches

**What to build:** A **Tools exposed** card on the AI clients page. It lists every MCP tool the server registers, with its description, a `write` tag on write tools, and an on/off switch. The switches are one global setting. Default: every tool on except `run_workflow`. A tool that is turned off is missing from the tool list an AI client sees. Because clients cache that list, a call to a turned-off tool is also refused with "tool is turned off". The card notes that Connection guards still apply.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Setting is stored in SQLite; the `--mcp` process reads it at call time, so a change applies without restarting the AI client
- [ ] Turned-off tools are missing from `tools/list` for a new MCP session
- [ ] A call to a turned-off tool returns a clear error; for a write tool the refusal is logged as blocked
- [ ] The card lists the registered tools (it is not a hard-coded list), with the switch state
- [ ] MCP seam test (list and call-time refusal) and route test (get/set, unknown tool rejected)
