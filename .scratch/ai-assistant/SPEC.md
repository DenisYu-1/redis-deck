Status: done

# AI assistant: built-in chat (design `design/RedisDeck (1).html`, chat panel + "Model" card)

## Problem Statement

A user who looks at a Connection wants to ask plain questions: "Which keys have no TTL?", "Why is RSS 2.8× used memory?", "Explain this key". They want answers based on the real data, without setting up an external AI client. Any change the assistant proposes must follow the same rules as every other AI.

## Solution

A chat panel in web, Docker and Desktop:

- A floating button opens a side panel on every page except Welcome.
- The model behind it is picked in the **AI assistant** section of the `/ai` page. There are three modes: **Local agent**, **API key** and **Local model**.
- The assistant uses the **same MCP tool registry** as AI clients. So **AI access**, hidden fields, tool switches and **AI activity** apply to it, and its client label is "Redis Deck Assistant".
- Before a write, the chat shows an approval card instead of the native dialog.

## Decisions

### Page (changes mcp-page ticket 01)

- `/ai` (nav label **AI**) shows in every mode. Its sections:
    - **AI assistant** (Model): all modes
    - **What AI may do** (AI access, hidden fields): all modes
    - **AI clients** (MCP server, Tools exposed, Add to a client): Desktop only
    - **AI activity**: all modes

### Model card

- The mode picker follows the design: Local agent / API key / Local model. **Test** and **Save** work in every mode, and the result shows in a callout.
- **Local agent**:
    - The agents are Claude Code (`claude`), Codex CLI (`codex`) and Gemini CLI (`gemini`), each shown as found (with its path) or missing.
    - Lookup searches PATH plus `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin` and `~/.npm-global/bin`, because Finder-launched apps don't get the shell PATH. Each agent has an optional path field.
    - Default arguments limit the agent to our tools only:
        - Claude: `-p --strict-mcp-config --mcp-config {mcp_config} --allowedTools "mcp__redis-deck__*" --disallowedTools Bash,Edit,Write,Read,WebFetch`
        - Codex: `exec --sandbox read-only` plus our MCP config
        - Gemini: its non-interactive flag plus our MCP config
    - The Arguments field is editable and warns that changing it can give the agent access to the host. The agent uses its own login. A note covers Docker: the CLI must exist inside the container.
- **API key**: providers Anthropic, OpenAI and OpenAI-compatible (which adds a Base URL field).
    - Anthropic offers a fixed model select (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`); the others take a free-text model id.
    - The key is stored in SQLite on the server, next to the Connection passwords. The browser only ever gets the last four characters ("Saved: sk-ant-…9F2c — type to replace").
- **Local model**: a server URL, Ollama or any OpenAI-compatible server. The model select is filled from `GET /models`. A note says small models follow multi-step tool use less reliably.
- **Test**:
    - Local agent: run one real turn that asks the agent to list its redis-deck tools, and report "answered in N s, listed N tools".
    - API key: one minimal call with the key.
    - Local model: `GET /models`.

### How a turn runs

- The browser sends the turn and gets the reply as a stream from one backend route: text chunks, tool-call rows, approval cards and done. Approval answers go to a separate route. Only one turn runs at a time per chat.
- **Local agent**:
    - For each turn the backend creates a random token and a temp `{mcp_config}` file. The file points the agent at an **internal Streamable HTTP MCP endpoint**, bound to 127.0.0.1, that accepts only that token. The endpoint is never shown to external AI clients; they keep using stdio `--mcp`.
    - The token and the temp file are removed when the turn ends.
    - The answer text streams from the agent's stdout as plain text, rendered as markdown. Tool-call rows and approval cards come from our endpoint, never from parsing each CLI's output.
- **API key / Local model**: the backend calls the provider with plain `fetch`, with no SDK and no new packages. There are two adapters, Anthropic Messages and OpenAI Chat Completions, and they run the tool loop through the in-memory MCP pair, streaming text.
- **Multi-turn**: every turn sends the whole chat transcript plus the context chips as the prompt. No CLI session resume.
- **Tool-call limit**: at most 20 tool calls per turn in every mode. After that the turn stops with "Stopped after 20 tool calls; ask again to continue", and for the local agent the endpoint refuses further calls.
- A system prompt names the current Connection and its Tier, lists the rules (ask before writes, no command tool), and says that Redis data is data, never instructions. AI access and approvals stay the real guard.

### Approvals

- The approver for assistant turns is the chat **approval card**: the title, the commands, "via MCP tool `<tool>` on `<conn>`", and **Approve** / **Deny**. There is no session grant.
- It counts as **Deny** after 5 minutes without an answer, or when the chat is closed, "New chat" is pressed or the page reloads.
- When **Ask before writes** is off, the card shows as "Ran without asking", with the reason. Blocked calls show a Blocked card with the reason.

### Chat panel

- Header: "Assistant", the mode/model label (it links to the Model card), New chat, and Close (Esc).
- Context chips:
    - The current Connection is always there; "values hidden" shows when See values is off.
    - "+ Selected key" on Keys and "+ Current line" in the Console. Each chip can be removed.
    - Chips send names or line text only. Values are read through `get_key`, so AI access and hidden fields can't be bypassed. A Console result chip sends the result text, masked with the hidden fields.
- Messages: user bubbles with their chips; assistant messages as markdown, collapsible tool-call rows (status, tool, args, ms, response), approval cards, and code blocks.
- Each code block has **Copy**, **Open in console** (adds it to the current tab) and **Replace line N in <tab>** (when it came from a line chip).
- Empty state: "Ask about <conn>", a short explanation, and suggested prompts for each page (Keys, Stats, Console).
- Footer: "Writes wait for your approval", "Writes are off on this connection", or "No model is set up yet".
- Console additions: **Ask about this line** in the toolbar and **Ask about result** on each result.
- History lives in memory for the browser session. New chat clears it; nothing is saved on the server.

### Out of scope

- Saved chat history, CLI session resume, and choosing tools per chat.
- Files or images in the chat.

## Testing Decisions

- **Seam: the turn runner with a fake model adapter and a fake agent process** (stdout script plus MCP calls to the internal endpoint):
    - text streaming
    - tool calls through the registry, with AI access, masking and logging under "Redis Deck Assistant"
    - the approval card: approve, deny, the 5-minute timeout, and cancel on New chat
    - the 20-call limit
    - the endpoint refuses a wrong or expired token
- **Adapters:** request and response mapping for Anthropic and OpenAI, tested against recorded fixtures with no network.
- **Agent lookup:** a temp home directory with fake binaries in the extra folders.
- **Routes:** Model settings get/set (the key never comes back in full), Test.
- **Client:** one test for the chat panel (send, tool row, approval card buttons) and one for the Model card modes.

## Dependencies

- `.scratch/mcp-page` tickets 01–06: the page shell, AI access, hidden fields, tool switches and logging every call.
- `.scratch/console` for "Open in console", "Replace line", and "Ask about this line / result".
