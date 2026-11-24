# 05: AI access: write / Workflows / ask before writes

**What to build:** The write side of **AI access** takes effect:

- **Write** off blocks the key write tools.
- **Workflows** off blocks `run_workflow`. `plan_workflow` stays allowed, because it only reads.
- **Ask before writes** is now the only trigger for the native approval dialog (Deny / Allow once / Allow for this session). On a production Tier it is always on and cannot be turned off.
- **Confirm writes** no longer triggers the dialog, per ADR 0005.
- **Read-only connection** still blocks every write.

The grid gets the design's disabled-cell rules and tooltips: "Allow keys first", "The connection itself is read-only", "Allow writes or workflows first", and "Always on for production".

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Write off and Workflows off block those calls with a clear message, logged as blocked
- [ ] Ask on asks the approver; ask off runs the write right away; production always asks, whatever is stored
- [ ] A Connection with Confirm writes on and ask off writes with no dialog
- [ ] Read-only blocks writes whatever the AI access settings are
- [ ] The server enforces "ask needs write or Workflows" and the production rule; the grid shows disabled cells with tooltips
- [ ] The existing approval seam tests move from Confirm writes to Ask before writes; new tests for the column rules
