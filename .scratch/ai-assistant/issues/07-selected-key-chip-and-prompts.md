# 07: Selected key chip and suggested prompts

**What to build:** On Keys, the chat offers "+ Selected key"; each added chip can be removed. The Connection chip shows "values hidden" when **See values** is off. Chips send names only; values are read through `get_key`, so AI access and hidden fields cannot be bypassed. User bubbles show the chips sent with them. The empty state adds suggested prompts for each page (Keys, Stats, Console).

**Blocked by:** 02

**Status:** done

- [x] "+ Selected key" adds the Key name to the next turn's context and can be removed
- [x] No value is ever sent from the client for a Key chip
- [x] "values hidden" follows AI access
- [x] Suggested prompts change with the page and send on click (Console prompts show once that page exists)
- [x] Client test for chips
