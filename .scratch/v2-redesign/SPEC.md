# RedisDeck v2 redesign

**Status:** ready-for-agent

Vocabulary: see `GLOSSARY.md` (Connection, Tier, Read-only connection, Confirm writes, Key, Key pattern, Saved search, Plugin, Workflow, Board). Respect `docs/adr/0001-*` (server-side Workflows, backend-enforced read-only). Design source: `design/RedisDeck.html`. Detailed design spec: `docs/v2-redesign/SPEC.md`. Tickets: `.scratch/v2-redesign/issues/`.

## Problem Statement

The current UI looks dated and is organised around a plugin-rendered Keys panel, a separate Settings page and a fixed Statistics page. Users working across local, staging and production Connections get no clear signal of how dangerous the current Connection is, nothing stops an accidental write to production, large keyspaces are hard to navigate, and repeatable maintenance tasks have no safe, guided place to live.

## Solution

Redesign the app to the RedisDeck design on a `v2` branch: a sidebar shell with a Connection switcher, light/dark/auto theme, a Keys page (tree/flat, filters, detail with a decoding inspector, bulk actions, Saved searches), a Connections page, a Welcome screen, Statistics Boards with tiles and time ranges, and a Workflows area for plugin-provided guided actions. Functionality stays roughly the same as today; safety is added at the server: Tier, Read-only connection and Confirm writes are enforced by the backend.

## User Stories

1. As a user, I want a sidebar with my Connections, Keys, Statistics and Workflows, so that I can move around the app quickly.
2. As a user, I want to switch the current Connection from the sidebar, so that I can compare environments without leaving my page.
3. As a user, I want each Connection to show a Tier badge (local/staging/prod), so that I always know which server I am on.
4. As a user on a production Connection, I want a banner stating whether it is Read-only or requires confirmation, so that I understand the rules before acting.
5. As a user, I want light, dark and automatic themes that persist, so that the app matches my environment.
6. As a user on a phone or narrow window, I want panes to stack, so that I can still use the app.
7. As a user with no Connections, I want a Welcome screen with a quick-add form, so that I can get started in one step.
8. As a user, I want to paste a Redis URI to fill a Connection form, so that I don't type each field.
9. As a user, I want to test a Connection before saving it, so that I know it works.
10. As a user, I want to set a Connection's Tier, db number, TLS, TLS verification and cluster flag, so that it reflects the real server.
11. As a user, I want to mark a Connection Read-only, so that no one can modify its data through the UI or API.
12. As a user, I want to mark a Connection Confirm writes, so that I must type its name before any write.
13. As a user, I want the server to reject writes on a Read-only connection, so that safety does not depend on the browser.
14. As a user, I want a clear error toast when a write is refused, so that I know why nothing changed.
15. As a user, I want my Connection passwords never shown again after saving, so that they stay private.
16. As a user, I want to leave the password blank when editing a Connection to keep it, so that I don't re-enter it.
17. As a user, I want to import and export Connections and reorder them, so that I can manage many of them.
18. As a user, I want to search Keys with a Redis glob Key pattern, so that I can find what I need.
19. As a user, I want matched text highlighted and `/` to focus search, so that searching is fast.
20. As a user, I want to filter Keys by type, so that I only see strings, hashes, lists, sets, zsets, streams or JSON.
21. As a user, I want to filter Keys by TTL (any, has, none, expiring within an hour), so that I can find expiring data.
22. As a user, I want to see each Key's type, TTL and size in the list, so that I can judge it without opening it.
23. As a user, I want a tree view grouped by `:` prefixes and a flat view, so that I can browse either way.
24. As a user with a huge keyspace, I want the list virtualized and loaded in pages with "Load more", so that the app stays responsive.
25. As a user, I want folder counts labelled as "loaded so far", so that I am not misled about totals.
26. As a user, I want to see real scan statistics (scanned, matched, time), so that I understand search cost.
27. As a user, I want to open a Key and see its TTL, memory, encoding, length and idle time, so that I can diagnose it.
28. As a user, I want hash, list, set and zset values shown as tables with a filter, so that I can scan large values.
29. As a user, I want stream and JSON Keys shown read-only as raw text, so that I can at least inspect them.
30. As a user, I want a value inspector that decodes as Auto, Raw, JSON or PHP-serialized, so that opaque values become readable.
31. As a user, I want timestamps in values hinted as dates, so that I can read them.
32. As a user, I want to copy a Key name or a value, so that I can use it elsewhere.
33. As a user, I want to rename, copy-to-name, delete and reload a Key, so that I can maintain data.
34. As a user, I want to edit a Key's TTL, so that I can extend or remove expiry.
35. As a user, I want to edit a string value, add a hash field and add a zset member, so that I can fix data in place.
36. As a user, I want a New key modal, so that I can create Keys of any supported type.
37. As a user, I want write controls disabled with an explanation on a Read-only connection, so that I know why.
38. As a user, I want to be asked to type the Connection name before a write on a Confirm-writes connection, so that I don't act on the wrong server.
39. As a user, I want to select many Keys and see "N selected of M matched", so that I can act in bulk.
40. As a user, I want to set or remove TTL on selected Keys, so that I can fix expiry in one action.
41. As a user, I want to export selected Keys as a JSON file (up to 1000), so that I can back up or inspect them.
42. As a user, I want to delete selected Keys after confirmation, so that I can clean up.
43. As a user, I want to save the current Key pattern as a Saved search per Connection, so that I can re-run it later.
44. As a user, I want Saved searches in the sidebar, so that they are one click away.
45. As a user, I want to delete a Saved search, so that the list stays tidy.
46. As a user, I want Statistics tiles for ops/sec, memory, hit rate, clients, CPU and keys with sparklines, so that I see health at a glance.
47. As a user, I want warning and critical states on tiles such as hit rate, so that problems stand out.
48. As a user, I want to pick a time range from 1h to 30d, so that I can see recent or long-term trends.
49. As a user, I want a Live/Paused toggle, so that I can freeze the view or watch it update.
50. As a user, I want charts with a hover crosshair and tooltip, so that I can read exact values.
51. As a user, I want Overview and Memory deep-dive Boards, so that I can focus on what I'm investigating.
52. As a user, I want to remove and restore widgets on a Board and have that remembered per Connection and Board, so that I can tailor my view.
53. As a user, I want slow log, command stats and memory-by-pattern widgets, so that I can find expensive operations.
54. As a plugin author, I want to declare Workflows with typed inputs in plugin config, so that users get a validated form for free.
55. As a plugin author, I want to implement server-side plan and run handlers, so that Workflows can dry-run, write safely and be audited.
56. As a user, I want to dry-run a Workflow and see what it would touch, so that I can trust it before running.
57. As a user, I want Workflow runs recorded with input, Connection, Tier, time and result, so that I have an audit trail.
58. As a user, I want write Workflows blocked on Read-only connections and confirmation-aware on Confirm-writes ones, so that they obey the same safety rules.
59. As a user, I want Workflows to appear in the sidebar only when a Plugin defines them, so that the UI isn't cluttered.
60. As a maintainer, I want dead plugins and the placeholder custom-execute endpoint removed, so that the codebase stays small.
61. As an existing user, I want my saved Connections to keep working after upgrade, so that nothing breaks.

## Implementation Decisions

- Branch `v2` from `main`; keep the working tree; never commit (stage only). Use yarn.
- Styling stays styled-components; one global token stylesheet (CSS variables) with a `data-theme` attribute; no new UI library; Geist/Geist Mono fonts.
- Routes: `/`→`/keys`; `/keys`; `/stats`, `/stats/:board`; `/workflows/:actionId`; `/connections` (`/settings` redirects); Welcome renders on every route when there are no Connections.
- Keys becomes a core page, no longer a Plugin. Plugin system stays for Workflows and legacy private components (their contract is unchanged).
- Connection model gains Tier, db, verify-TLS, Read-only and Confirm-writes via an inline startup migration; the CLI layer uses db and TLS-verify. A Connection's id remains its display name.
- Write guard applies to all mutating routes and write commands; Read-only → 403; Confirm writes → 428 unless a confirm header equals the Connection id. The UI mirrors this but does not replace it.
- Passwords are never returned by any read endpoint; blank on update keeps the stored value; the export endpoint is audited for leaks.
- Keys API: pages include per-key type/TTL/size (pipelined); type filter via SCAN TYPE; TTL filter server-side; real scan stats; `GET` meta endpoint (encoding, idle, memory, length); bulk TTL endpoint; bulk export endpoint capped at 1000 keys (400 above).
- Key tree is built client-side from loaded keys; virtualization with the existing `react-window` dependency.
- Saved searches stored in SQLite per Connection; Tier badge derived, not stored.
- Statistics: keep the 5-minute snapshot collector (30-day retention); ranges 1h/6h/24h/7d/30d from history; Live polls realtime every 10 s and updates tile values and sparkline tail only; Boards Overview and Memory deep-dive built from existing widgets; layout edits persisted in localStorage per Connection + Board.
- Workflows: optional `actions` manifest in plugin config; server-side handler modules exporting plan and run, with private ones in a gitignored extensions directory; list/plan/run endpoints; run history in SQLite; ships one trivial example only (ADR 0001).
- `env`/`environment` request parameter keeps meaning "connection id".
- Delivery order: theme+shell → connection safety → Connections page → Welcome → Keys list → detail read → detail write → bulk → Saved searches → Stats Overview → Stats Memory+layout → Workflows → cleanup and `dist/` rebuild (13 tickets).

## Testing Decisions

- Good tests assert external behaviour only: HTTP status and body for the API, return values for pure functions. No assertions on internal calls, component structure or styling.
- Seam 1 (primary): backend HTTP API via `supertest` against a real Redis, following the existing route and service suites (Redis target configurable by the `REDIS_TEST_*` variables, `test:*` key prefix, per-test cleanup). Covers the write guard on every mutating route, page metadata, meta endpoint, bulk TTL and export (including cap), saved searches, Workflows plan/run/history, migration and password masking.
- Seam 2 (new, small): Jest unit tests for pure frontend utilities: key tree, glob, TTL/bytes formatting, URI parser, PHP/JSON decoders, selection logic.
- Browser verification (manual, Claude in Chrome against `yarn dev`): golden path, console errors, light/dark and phone width for each UI ticket. Not an automated seam.
- No snapshot, visual or per-component tests.

## Out of Scope

- Custom widget builder, expression engine, `/stats/new-widget`, threshold webhooks and alerting, the "Works on" panel.
- Plugin-provided Queues Board; Latency widget; 15m range; 10-second background poller.
- Real built-in Workflows (News Feed, Booking Manager are private plugins); the design's mock data.
- Editing stream and JSON values; true per-folder totals in the tree; renaming the `env` parameter; separating a Connection's id from its display name.
- Visual/snapshot tests; a new UI library; multi-user authentication.

## Further Notes

- `dist/` and `public/` are committed build output: rebuild once at the end (ticket 13), not per step.
- The design file is a mock with a seeded RNG; treat its sample data as illustrative only.
- Tracker was not configured, so this spec and its tickets are local files; run `/setup-matt-pocock-skills` to publish them to GitHub or another tracker.
