# RedisDeck v2 redesign: spec

Source design: `design/RedisDeck.html` (single-file mock, fake data). Branch: `v2` from `main` HEAD, working-tree changes carried along. Do not commit; stage new files only. Use yarn. Vocabulary: see `/GLOSSARY.md`. Decision record: `docs/adr/0001-*.md`.

Goal: new look and shell, functionality roughly unchanged, same module/separation-of-concern structure (pages, components, hooks, services, utils; routes, services).

## 1. Principles
- Logic on the backend; UI reflects it. Read-only and Confirm-writes are enforced server-side.
- Styled-components stays. Design tokens live in one `client/styles/theme.css` (CSS vars, `data-theme` on `<html>`); components use `var(--…)`. No new UI library. Fonts: Geist / Geist Mono (Google Fonts).
- Theme: Auto (system) default, Light, Dark; persisted in localStorage via existing `useTheme`.
- Responsive: breakpoints 1100 / 860 / 480 as in the design; panes stack on phones; `prefers-reduced-motion` respected.
- Naming: `env`/`environment` query param stays = connection id (no rename in v2). The design's env badge is **Tier** (`tier`).
- A connection's `id` is today also its display name; "Confirm writes" asks the user to type it.

## 2. Routes
| Path | Page |
|---|---|
| `/` | redirect to `/keys` |
| `/keys` | Keys |
| `/stats`, `/stats/:board` | Statistics (`overview` default, `memory`) |
| `/workflows/:actionId` | Workflow |
| `/connections` | Connections (`/settings` redirects here) |
| any, with zero connections | Welcome |

## 3. Shell (design: sidebar + main)
- `AppShell`: sidebar + scrolling main. `ProdBanner` on tier=production ("Read-only: …" or "Writes ask you to type the connection name").
- `Sidebar`: brand, `ConnectionSwitcher` (menu with tier badges, "Manage connections"), nav Keys (+count) / Statistics, context group (Keys: Saved searches with "+"; Stats: Boards), Workflows group (plugins → actions, only when enabled plugins define actions), footer: Settings link, theme segmented control, server version + ping.
- Shared `components/ui/`: Button, Chip, Badge (type colours `--t-*`), Segmented, Modal, Toast, EmptyState, Spark.

## 4. Keys page (`pages/Keys/`)
UI (from design): search bar (Redis glob, `/` shortcut focuses), TTL filter (any / has / none / <1h), type chips (all, string, hash, list, set, zset, stream, json), New key button, scan line, key list with select-all, tree/flat toggle, rows (checkbox, name with muted prefix + highlighted match, type badge, TTL (warn <5 min), size), selection bar (Set TTL, Export, Delete…), detail pane.
Detail: header (type badge, name, copy-name, rename, reload, delete, copy-to-name), meta (TTL + edit, Memory, Encoding, Length, Idle), tools row (field/item filter, add field), table per type, value inspector with Auto/Raw/JSON/PHP decode, Copy, Edit (strings).
- hash/list/zset: tables as in design. `set`: member table (no index). `stream`/`json`: read-only raw view.
- Kept operations: rename, copy-to-name, set TTL, delete, New key (modal, replaces AddKeyForm panel), add hash field, zadd, edit string.
- Data: SCAN + cursor paging with "Load more" (existing `/keys`). Tree built client-side from loaded keys only (`utils/keyTree.ts`), virtualized with `react-window`. Folder counts mean "loaded so far", labelled so. Type filter -> SCAN `TYPE`.
- Backend additions: per-page metadata (pipelined `TYPE`/`TTL`/`MEMORY USAGE`) returned with `/keys`; TTL filter applied server-side on that; real scan stats for the scan line; `GET /keys/:key/meta` (encoding, idle, memory, length).
- Bulk: `POST /keys/ttl` (set TTL or PERSIST for N keys, pipelined), `POST /keys/export` (JSON `[{key,type,ttl,value}]`, cap 1000, 400 above). Existing bulk delete kept. All writes guarded.
- Saved searches: SQLite `saved_searches(connection_id, name, pattern)`; `GET/POST/DELETE /api/saved-searches`. Prod badge derived from Connection tier.

## 5. Connections page (`pages/Connections/`)
Master-detail: list + form. Fields: name(id), tier, host, port, db, user, password, URI paste (`uriParser.ts`), TLS, verify TLS, cluster, read-only, confirm writes. Test connection. Keep import/export JSON and reorder (`displayOrder`). Passwords are never sent to the client (list already omits them): form shows a masked placeholder; blank on save = unchanged. Check `/connections/export` does not leak passwords unless intended.
- Migration (inline in `services/database.js` style): add columns `tier TEXT DEFAULT 'local'`, `db INTEGER DEFAULT 0`, `verify_tls INTEGER DEFAULT 1`, `read_only INTEGER DEFAULT 0`, `confirm_writes INTEGER DEFAULT 0`. `redis.js` passes `-n db` and TLS verify flags to `redis-cli`.
- Guard `guards/writeGuard.js` on all mutating routes (keys write/delete/rename/expire/copy/zadd/bulk, `/flush`, `/exec` for write commands, workflow run where `writes:true`): 403 if read-only; if confirm-writes, require `X-Confirm-Connection` header equal to the connection id, else 428.

## 6. Welcome
Shown when no connections: brand, short intro, quick-add form (name, host, port, URI, Test, Save). Replaces `EmptyState`.

## 7. Statistics page (`pages/Stats/`)
- Header: board title, caption "Snapshots every 5 min · 30-day retention · <connection>", range 1h/6h/24h/7d/30d (from `/history`; 15m dropped), Live/Paused (polls `/realtime` every 10 s; updates tile values and sparkline tail only), Edit layout / Done / Restore removed.
- Tiles: Ops/sec, Memory, Hit rate (warn <90, crit <75), Clients, CPU, Keys; sparkline from history.
- Boards: **Overview** (memory, keyspace, commands, slowlog, patterns) and **Memory deep-dive**. Widgets map to existing components (`ChartsSection`, `CommandStatsTable`, `SlowLogTable`, `MemoryPatternAnalysis`, `MetricsGrid`), restyled; chart hover crosshair + tooltip as in the design. Layout edits persisted per connection+board in localStorage.

## 8. Workflows (`pages/Workflows/`)
- Plugin config gains optional `actions: [{id,title,desc,writes,inputs:[{name,label,type:int|uuid|select,required,placeholder,hint,options,def}]}]`.
- Page: action form with validation (required, int, uuid), Dry run (plan panel), Run, history list (user input, connection, tier, time, ok, text).
- Backend: `GET /api/workflows`, `POST /api/workflows/:id/plan`, `POST /api/workflows/:id/run`. Handlers at `services/workflows/<pluginId>/<actionId>.js` exporting `plan(inputs, ctx)` and `run(inputs, ctx)`; private ones in gitignored `services/workflows/extensions/`. `writes:true` actions go through the write guard. History in SQLite `workflow_runs`. Repo ships one trivial example only.
- Legacy free-form plugin components (extensions) keep their current contract.

## 9. Proposed file layout
```
client/styles/theme.css
client/components/layout/   AppShell Sidebar ConnectionSwitcher ProdBanner ThemeToggle
client/components/ui/       Button Chip Badge Segmented Modal Toast EmptyState Spark
client/pages/Keys/          KeysPage KeyToolbar KeyList SelectionBar KeyDetail ValueTable ValueInspector modals/ hooks/
client/pages/Stats/         StatsPage Tile BoardHeader widgets/ boards.ts
client/pages/Workflows/     WorkflowPage ActionForm PlanPanel RunHistory
client/pages/Connections/   ConnectionsPage ConnectionForm uriParser.ts
client/pages/Welcome/       Welcome
client/utils/               keyTree glob ttl bytes decoders/{php,json}
client/store/useAppStore.ts connections, current connection, theme
guards/writeGuard.js  services/{keyMeta,savedSearches,workflows}.js  routes/{workflows,savedSearches}.js
```
Cleanup: delete `plugins/plugins/batchDelete`, `keyOperations`; migrate `keysManager` hooks/modals/`valueUtils` into `pages/Keys/`; remove `plugins/core/*.js` and legacy `view.html` if unreferenced. Do not touch `extensions/*`. Remove `/api/custom/execute` once unused.

## 10. Tests
Backend Jest vs real Redis: write guard (403/428 on every write route), meta endpoint, page metadata, bulk TTL/export (+cap), workflows plan/run/history, saved searches, connection migration. Frontend Jest+RTL: `utils/*`, key tree + selection logic. No snapshot/visual tests.

## 11. Delivery order (each step builds, lints, works before the next)
0. Backend (connection fields + migration, guard, meta/page metadata, bulk, saved searches, workflows)
1. Theme, shell, sidebar, router, Welcome
2. Keys
3. Connections
4. Statistics
5. Workflows
Every UI step is also checked in a real browser (Claude in Chrome against `yarn dev`: golden path, console errors, light/dark, phone width) before it counts as done.
`dist/` rebuilt once at the end (`yarn build`); `yarn lint`, `yarn type-check`, `yarn test` green at every step.

## 12. Out of scope (v2.0)
- Custom widget builder, expression engine, `/stats/new-widget`, threshold webhooks/alerting, "Works on" compatibility panel (hide the "+ Widget" button).
- Plugin-provided **Queues** board; Latency widget (no backend source); 15m range; "INFO every 10 s" background poller.
- Real built-in Workflows (News Feed, Booking Manager are private plugins); the design's sample data/seeded RNG/fake series.
- Editing of stream/json values; true per-folder totals in the key tree; renaming `env` -> connection param or `id` -> separate display name.
- Visual/snapshot tests; new UI library; multi-user auth.
