# 06: Local agent: Codex CLI and Gemini CLI

**What to build:** Codex CLI (`codex`) and Gemini CLI (`gemini`) join the Local agent list with the same found/missing status, path and Arguments fields and **Test**. Default arguments: Codex `exec --sandbox read-only` plus our MCP config; Gemini its non-interactive flag plus our MCP config. Check each CLI's current docs for its MCP config format, and confirm the defaults limit it to our tools as far as the CLI allows; report any gap to the user.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Each agent can be found, selected, saved, tested and chatted with
- [ ] The per-turn token and config work for each; the user's own CLI config is not modified
- [ ] Tool-call rows, approval cards and the 20-call limit work as with Claude Code
- [ ] Tests cover each agent's arguments and generated config
