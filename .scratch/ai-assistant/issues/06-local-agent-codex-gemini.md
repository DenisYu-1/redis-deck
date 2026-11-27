# 06: Local agent: Codex CLI and Gemini CLI

**What to build:** Codex CLI (`codex`) and Gemini CLI (`gemini`) join the Local agent list with the same found/missing status, path and Arguments fields and **Test**. Default arguments: Codex `exec --sandbox read-only` plus our MCP config; Gemini its non-interactive flag plus our MCP config. Check each CLI's current docs for its MCP config format, and confirm the defaults limit it to our tools as far as the CLI allows; report any gap to the user.

**Blocked by:** 05

**Status:** done

- [ ] Each agent can be found, selected, saved, tested and chatted with
- [ ] The per-turn token and config work for each; the user's own CLI config is not modified
- [ ] Tool-call rows, approval cards and the 20-call limit work as with Claude Code
- [x] Tests cover each agent's arguments and generated config

The three unticked boxes hold for Codex CLI 0.172.0 (Test, chat, a write approved on a card and `config.toml` unchanged, checked live; the rest against a fake) but **not verified for Gemini CLI**: it is not installed, so it was built from its docs and source and tested against a fake only.

## Gaps (what the default arguments cannot close)

Codex CLI:

- `apply_patch` cannot be switched off. The read-only sandbox rejects its writes, but it checks a patch against the file first, so it can confirm a guessed line of any file the user can read (also `data/redis-config.sqlite`). It returned no file content.
- The user's global `~/.codex/AGENTS.md` still reaches the model.
- `$name` in the prompt would attach an installed skill; a zero-width space after each `$` stops that, and is removed from what the agent sends back. It relies on how 0.172.0 reads mentions.
- Only the final answer is printed, so the answer does not stream.
- `OPENAI_API_KEY` / `CODEX_API_KEY` in the server's environment may take the place of the user's login.

Gemini CLI (all unverified):

- `--admin-policy` is ignored on a machine that already has system policy files; its built-in tools are then limited only by its headless defaults, which allow reading files.
- System settings override the turn's settings.
- Chats are saved under `~/.gemini`.
- `\@` escaping stops `@path` from attaching files; it is also removed from what the agent sends back, so a literal `\@` copied from data would become `@` (the approval card shows the result).
- Since June 2026 Google-account (free, Pro, Ultra) logins are no longer served; an API key, Vertex or an enterprise licence is needed.
