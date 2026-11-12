# 13: Cleanup + release build

**What to build:** Dead code from the old UI is gone and the committed build output matches v2. Spec §9, §11.

**Blocked by:** 04, 07, 08, 09, 11, 12

**Status:** ready-for-agent

- [ ] Delete batchDelete and keyOperations plugins, legacy core plugin JS and `view.html` files if unreferenced; leave private extensions untouched
- [ ] Remove `/api/custom/execute` and its tests once nothing uses it
- [ ] Update README, CLAUDE.md, plugin README for the new structure and routes
- [ ] `yarn lint`, `yarn type-check`, `yarn test` green; `yarn build` run to refresh `dist/`
- [ ] Manual pass of every route in light and dark, desktop and phone width
- [ ] Browser check (Claude in Chrome, `yarn dev` on :5173 with real Redis): after `yarn build` + `yarn start`, walk every route on :3000 in light and dark, desktop and phone width; no console errors
