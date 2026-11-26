# 01: Model card: Anthropic API key

**What to build:** An **AI assistant** section (the Model card) at the top of the `/ai` page, in every mode (web, Docker, Desktop). In this ticket it offers the **API key** mode with the Anthropic provider: the user picks a model from the fixed list (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`), pastes a key, and presses **Save** or **Test**. The result shows in a callout. Test makes one minimal call with the key, using plain `fetch` (no SDK, no new packages). The key is stored in SQLite on the server; the browser only ever gets its last four characters ("Saved: sk-ant-…9F2c — type to replace"). The page's section order and copy follow the spec's "Page" decisions: AI assistant, What AI may do, AI clients (Desktop only), AI activity. Follow the design's card; later tickets add the other modes to the picker.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Model settings are stored through a versioned migration (ADR 0004)
- [ ] No route response contains the full key; saving without typing a new key keeps the stored one
- [ ] Test reports success or the provider's error in the callout, and the error never contains the key
- [ ] The AI assistant section shows in web, Docker and Desktop; AI clients stays Desktop-only
- [ ] Route tests for get/set and Test against a faked provider (no network); one client test for the card
