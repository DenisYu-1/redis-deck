# 02: Docker data folder is a bind mount

**What to build:** A Docker user can reach the app's data folder from the host, so `./data/plugins/` can be edited without `docker cp`. See `.scratch/external-plugins/SPEC.md` and ADR 0003.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Base compose maps `./data` on the host to the app's data folder, replacing the named volume
- [ ] The unused named-volume declaration is removed from base compose
- [ ] The now-redundant data mount is removed from the override compose file, keeping its network settings
- [ ] `docker compose config` validates for base and base+override
- [ ] The old named volume is left untouched (no migration)
