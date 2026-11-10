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
- `routes/` — one router per concern: `connections`, `keys`, `environment`, `info`, `stats`, `searches` (saved searches), `workflows`.
- `guards/writeGuard.js` — enforces Read-only / Confirm-writes connections on every write route (403 / 428). Any new write route or Workflow must go through it.
- `services/redis.js` — **the Redis layer shells out to `redis-cli` via `execSync`** (no client library for data ops despite `redis` being a dep). Builds CLI args from stored connection config, handles `--csv`/`--raw` modes, cluster node scanning, INFO parsing, pipelined commands. `redis-cli` must be on PATH.
- `services/database.js` — `better-sqlite3` at `data/redis-config.sqlite`. Stores connection definitions (incl. passwords), saved searches, workflow run history and stats snapshots; contains an inline schema-migration check on startup.
- `services/{keyMeta,keyStore,bulkKeys,workflows}.js`, `services/statsCollector.js` — key metadata/pages, bulk TTL/export, the Workflow registry/runner, and INFO snapshots (30-day retention).

**Frontend** — React 18 + TypeScript + Vite, in `client/`. Design reference: `design/`, spec: `docs/v2-redesign/SPEC.md`, terms: `GLOSSARY.md`.
- `client/App.tsx` — routes inside `AppShell`: `/` redirects to `/keys`; `/keys`, `/stats` and `/stats/:board`, `/connections`, `/workflows/:actionId`; `/settings` redirects to `/connections`. Pages live in `client/pages/<Name>/` (`Keys`, `Statistics`, `Workflows`, `Connections`, `Welcome`).
- Shared UI in `client/components/{layout,ui}/`; pure helpers in `client/utils/`; theme tokens in `client/styles/`.
- State: Zustand single store `client/store/useAppStore.ts` (connections, current connection, theme). Path alias `@/` → `client/`.
- API calls go through `client/services/apiService.ts`.
- Dark mode persisted in localStorage.

**Plugins = Workflows** — there is no client-side plugin runtime any more.
- Manifests: `client/plugins/config/config.json` (tracked) merged with gitignored `config.override.json` by plugin `id` (override wins, `enabled:false` disables), read by `services/workflows.js` and served via `GET /api/workflows`.
- Handlers: `services/workflows/<pluginId>/<actionId>.js` exporting `plan` and `run`; private ones in gitignored `services/workflows/extensions/`. See `client/plugins/README.md`.
- `/api/custom/execute` was removed; do not reintroduce generic command execution.

## Notes

- The `env` / `environment` query param throughout the API is a **connection id** from the SQLite store, not a Redis DB number.
- `dist/` and `public/` are committed build output; the running server serves from `dist/`.
