# 04: OpenAI, OpenAI-compatible and Local model

**What to build:** The Model card gains the OpenAI and OpenAI-compatible providers (free-text model id; OpenAI-compatible adds a Base URL field) and the **Local model** mode: a server URL (Ollama or any OpenAI-compatible server) with a model select filled from `GET /models`, and a note that small models follow multi-step tool use less reliably. The chat works with each of them through one OpenAI Chat Completions adapter, plain `fetch`, same tool loop and streaming as Anthropic.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Each provider and the Local model can be saved, tested and chatted with
- [ ] Test: one minimal call for API key providers; `GET /models` for Local model
- [ ] The key is handled as in 01 and is never sent to a provider or URL it was not entered for
- [ ] The chat header shows the active mode and model
- [ ] Adapter mapping tests from recorded fixtures (no network); one client test for the card modes
