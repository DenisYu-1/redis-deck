# 01: Theme + app shell

**What to build:** The user opens the app and sees the new RedisDeck look: sidebar + main working area, light/dark/auto theme, connection switcher, new route table. Existing pages still work inside the new shell. Spec: `docs/v2-redesign/SPEC.md` §1–3.

**Blocked by:** None (can start immediately). Create branch `v2` from `main` first (keep the dirty tree; do not commit).

**Status:** ready-for-agent

- [ ] Design tokens (light/dark/auto) in one global stylesheet; fonts Geist / Geist Mono; `data-theme` driven by existing theme hook, Auto default, persisted
- [ ] Sidebar: brand, Connection switcher (menu + "Manage connections"), Keys/Statistics nav, theme toggle, server/ping footer
- [ ] Routes: `/`→`/keys`, `/keys`, `/stats`, `/stats/:board`, `/connections`, `/settings`→`/connections`
- [ ] Shared UI primitives (Button, Chip, Badge, Segmented, Modal, Toast, EmptyState)
- [ ] Panes stack at the design breakpoints (1100/860/480); reduced-motion respected
- [ ] `yarn lint`, `yarn type-check`, `yarn test` green
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): every route renders in the shell; theme toggle switches light/dark/auto; panes stack at phone width; no console errors
