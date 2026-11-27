# 03: Writes with approval cards

**What to build:** The assistant can propose writes, under the same rules as every other AI. Where **Ask before writes** is on, the chat shows an **approval card** instead of the native dialog: the title, the commands, "via MCP tool `<tool>` on `<conn>`", and **Approve** / **Deny**. There is no session grant. Answers go to a separate route and the turn continues. When **Ask before writes** is off, the card shows as "Ran without asking", with the reason. Blocked calls show a Blocked card with the reason. The footer reads "Writes wait for your approval" or "Writes are off on this connection". The approval request must carry enough to list the commands; today it names only the operation and target.

**Blocked by:** 02

**Status:** done

- [x] Approve runs the write; Deny does not, and it is logged as denied
- [x] Counts as Deny after 5 minutes, and when the chat is closed, New chat is pressed or the page reloads
- [x] No session grant: the next write asks again
- [x] Ran without asking and Blocked cards show their reason
- [x] The native approval dialog for external AI clients behaves as before
- [x] Turn runner tests for approve, deny, timeout and cancel; one client test for the card buttons
