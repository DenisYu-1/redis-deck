# 06: Workflow tools

**What to build:** An AI client can list Workflows with their inputs, dry-run one (plan) and run it. Run follows the same guard rules as other writes, including the approval dialog. See `.scratch/mcp-server/SPEC.md`.

**Blocked by:** 05

**Status:** done

- [x] Tools: list Workflows, plan Workflow (read), run Workflow (write)
- [x] Run: Read-only → blocked; Confirm writes → approver; otherwise runs right away
- [x] Runs show up in the existing Workflow run history as UI runs do
- [x] Seam tests: list, plan has no effect on Redis, run changes Redis, guard cases
