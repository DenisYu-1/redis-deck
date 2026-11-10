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
- `config/app.js` — builds the Express app: JSON middleware, static `dist/` + `/public`, mounts routers under `/api` (+ `/api/custom`, `/api/stats`), SPA fallback serves `dist/index.html` for all other routes.
- `routes/` — one router per concern: `connections`, `keys`, `environment`, `info`, `custom`, `stats`.
- `services/redis.js` — **the Redis layer shells out to `redis-cli` via `execSync`** (no client library for data ops despite `redis` being a dep). Builds CLI args from stored connection config, handles `--csv`/`--raw` modes, cluster node scanning, INFO parsing, pipelined commands. `redis-cli` must be on PATH.
- `services/database.js` — `better-sqlite3` at `data/redis-config.sqlite`. Stores connection definitions (incl. passwords) and stats snapshots; contains an inline schema-migration check on startup.
- `services/statsCollector.js` — parses `INFO` into snapshot rows in SQLite; 30-day retention.

**Frontend** — React 18 + TypeScript + Vite, in `client/`.
- `client/App.tsx` — three routes: `/` (`Home`), `/settings`, `/statistics`. Pages live in `client/pages/<Name>/`.
- State: Zustand single store `client/store/useAppStore.ts` (connections, current environment, selected key). Path alias `@/` → `client/`.
- API calls go through `client/services/apiService.ts`.
- Styling: styled-components; dark mode persisted in localStorage.

**Plugin system** — `client/plugins/`.
- `core/PluginManager.js` fetches `/js/plugins/config.json` and optionally `config.override.json`, merges by plugin `id` (override wins, `enabled:false` disables). Built-in config is `client/plugins/config/config.json` (tracked); `config.override.json` is gitignored for local/private plugins.
- Plugin components get `{ context, emit, on }` props. `context` exposes `getCurrentEnvironment()`, `onOperationComplete()`, `showToast()`.
- Built-in plugins under `client/plugins/plugins/`; private ones under `client/plugins/plugins/extensions/`.

## Notes

- The `env` / `environment` query param throughout the API is a **connection id** from the SQLite store, not a Redis DB number.
- `dist/` and `public/` are committed build output; the running server serves from `dist/`.
