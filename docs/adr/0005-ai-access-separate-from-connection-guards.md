# AI access is separate from the Connection guards

AI clients get their own per-Connection rules, **AI access** (see Keys, see values, write, run Workflows, ask before writes). These rules are the only thing that decides whether an MCP write needs approval. **Confirm writes** is a check for people in the app only: they type the Connection name. It no longer triggers the MCP approval dialog. **Read-only connection** still blocks every write from every source. On a production Tier, "ask before writes" is always on and cannot be turned off.

Before, Confirm writes did both jobs. That tied the friction for people to the friction for AI clients. A user who wanted the AI to ask on staging had to make themselves type the Connection name too, and there was no way to hide values or block writes for AI clients alone. We considered keeping one flag and adding AI-only columns next to it. We rejected that because it gives "Confirm writes" two meanings depending on who writes.

Consequences: when a reader sees that Confirm writes does not prompt the AI, this is on purpose. Undoing the split later would mean merging the AI access rows users have set up back into the Connection flags.
