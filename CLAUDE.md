# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreements (from `.cursor/rules`)

- Use **yarn**, never npm.
- **Do not commit.** Stage new files with `git add` only; leave committing to the user.
- Put logic on the **backend** where possible; keep files/modules small and single-purpose.
- Every change must actually work. Ask when a requirement is unclear rather than guessing.

## Commands

- `yarn dev` — Vite frontend (`:5173`) + nodemon backend (`:3000`) via concurrently. Vite proxies `/api` to the backend.
- `yarn build` — `tsc --noEmit` type-check then `vite build` into `dist/`.
- `yarn start` — run the built app (`node server.js`), serves `dist/` on `:3000`.
- `yarn lint` / `yarn lint:fix` — ESLint (`--max-warnings 0`) over `ts,tsx`; fix also runs Prettier.
- `yarn type-check` — `tsc --noEmit`.
- `yarn test` — Jest. `yarn test <file>` runs one suite (e.g. `yarn test redis.test.js`), `-t "<name>"` one case, `yarn test:watch` for watch.
- Docker: `docker compose up -d` → UI on `:2222`.

### Tests need a real Redis

Backend tests in `__tests__/` open real Redis connections (no mocks). Redis must be running and reachable. Override target with `REDIS_TEST_HOST` / `REDIS_TEST_PORT` / `REDIS_TEST_USER` / `REDIS_TEST_PASSWORD` / `REDIS_TEST_TLS` / `REDIS_TEST_CLUSTER` (default `127.0.0.1:6379`). Test keys use the `test:*` prefix and are cleaned up per-test.

## Architecture

Two processes, one repo:

**Backend** — Express (CommonJS, `.js`), no build step, run directly with node/nodemon.

- `server.js` — entry: creates app, starts two `setInterval` loops (stats snapshot every 5 min, cleanup every 24 h), listens on `PORT` (default 3000).
- `config/app.js` — builds the Express app: JSON middleware, static `dist/` + `/public`, mounts routers under `/api` (+ `/api/stats`), SPA fallback serves `dist/index.html` for all other routes.
- `routes/` — one router per concern: `connections`, `keys`, `environment`, `info`, `stats`, `searches` (saved searches), `workflows`, `jobs` (bulk delete/export jobs), and the AI page's `aiAccess`, `aiTools`, `aiHiddenFields`, `aiActivity` (AI activity log, `/api/ai-activity`) and `aiClients`.
- `guards/writeGuard.js` — enforces Read-only / Confirm-writes connections on every write route (403 / 428). Any new write route or Workflow must go through it.
- `services/redis.js` — **on clustered Connections every Redis call shells out to `redis-cli`** (async `execFile`, no shell; ADR 0002). Non-clustered Connections use the persistent client in `services/redisClient.js` for scans and Page meta. Builds CLI args from stored connection config, handles `--csv`/`--raw`/`--json` modes, parallel cluster Node scans, INFO parsing, batched stdin sessions. `redis-cli` must be on PATH.
- `services/connectionState.js` — per-Connection in-memory state: the 4-process `redis-cli` cap (applied at the single spawn point) and the 30 s topology cache.
- `services/perNode.js` — runs per-Key commands batched per owning Node (MOVED retried once per owner); used by Page meta, sizes and the jobs.
- `services/database.js` — `better-sqlite3` at `data/redis-config.sqlite`. Stores connection definitions (incl. passwords), saved searches, workflow run history and stats snapshots; schema changes run as versioned migrations on startup (ADR 0004).
- `services/{keyMeta,keyStore,bulkKeys,workflows}.js`, `services/statsCollector.js` — key metadata/pages, bulk TTL/export, the Workflow registry/runner, and INFO snapshots (30-day retention).
- `services/{jobs,deleteJob,exportJob,scanPages}.js` — in-memory Jobs (lost on restart): one running Job per kind per Connection, one scan page at a time.

**Frontend** — React 18 + TypeScript + Vite, in `client/`. Design reference: `design/`, spec: `docs/v2-redesign/SPEC.md`, terms: `GLOSSARY.md`.

- `client/App.tsx` — routes inside `AppShell`: `/` redirects to `/keys`; `/keys`, `/stats` and `/stats/:board`, `/connections`, `/ai` (AI clients, access, tools, hidden fields, activity log; replaces the old `/ai-activity` route), `/workflows/:actionId`; `/settings` redirects to `/connections`. Pages live in `client/pages/<Name>/` (`Keys`, `Statistics`, `Workflows`, `Connections`, `Ai`, `Welcome`).
- Shared UI in `client/components/{layout,ui}/`; pure helpers in `client/utils/`; theme tokens in `client/styles/`.
- State: Zustand single store `client/store/useAppStore.ts` (connections, current connection, theme). Path alias `@/` → `client/`.
- API calls go through `client/services/apiService.ts`.
- Styling is plain CSS with `var(--…)` tokens from `client/styles/` (no CSS-in-JS). Dark mode persisted in localStorage.

**Plugins = Workflows** — there is no client-side plugin runtime any more.

- Manifests: `client/plugins/config/config.json` (tracked) merged with gitignored `config.override.json` by plugin `id` (override wins, `enabled:false` disables), read by `services/workflows.js` and served via `GET /api/workflows`. The External Plugins manifest `$DATA_DIR/plugins/config.json` is merged last.
- Handlers: `services/workflows/<pluginId>/<actionId>.js` exporting `plan` and `run`; private ones in gitignored `services/workflows/extensions/`. External handlers in `$DATA_DIR/plugins/<pluginId>/<actionId>.js` are looked up first. See `client/plugins/README.md`.
- `/api/custom/execute` was removed; do not reintroduce generic command execution. The Console runs only commands from its server-side allowed list, through the write guard (ADR 0006); AI clients and the AI assistant never get a command tool.

## Notes

- The `env` / `environment` query param throughout the API is a **connection id** from the SQLite store, not a Redis DB number.
- `public/` is committed; `dist/` is built output (gitignored) that the running server serves — run `yarn build` first.
