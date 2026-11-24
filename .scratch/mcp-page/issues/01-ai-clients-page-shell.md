# 01: AI clients page shell

**What to build:** An **AI** page (`/ai`, nav label **AI**) in every mode, with its nav item in the sidebar foot, below Settings. It uses the design's layout: two columns with a full-width log below. The current AI client install rows (Install / Reinstall / Remove / Manual setup), the "Log AI operations" switch and the current AI activity table move onto it unchanged. The **AI clients** section (MCP server card, client rows) is Desktop-only; the log and the later **What AI may do** section show in every mode. A new **MCP server** card shows the stdio command (`<binary> --mcp`) with a Copy button. It has no status pill and the nav item has no status dot. The AI clients panel on the Connections page and the `/ai-activity` page go away. This is a prefactor: later tickets add their cards to this page.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `/ai` route and nav item render in every mode; the AI clients section renders only in the Desktop app
- [ ] Layout follows the design (left column, right column, full-width log) using the existing `var(--…)` tokens, and stacks on narrow widths
- [ ] MCP server card shows the exact command the installer writes, with Copy
- [ ] Client rows, the Manual setup popup, the log switch and the activity table work as before
- [ ] The Connections page has no AI panel; `/ai-activity` is gone; the existing UI tests move to the new page and pass
