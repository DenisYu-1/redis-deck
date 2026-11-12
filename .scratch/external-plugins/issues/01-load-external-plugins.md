# 01: External Plugins load from the data folder

**What to build:** A user drops a manifest and handlers into a `plugins` folder inside the data folder, restarts, and the External Plugin's **Workflows** appear in the Workflows list and can be planned and run like any built-in one. See `.scratch/external-plugins/SPEC.md` and ADR 0003.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] External manifest is merged last by Plugin `id`, so it wins over the built-in manifest and the config override
- [ ] `enabled: false` in the External manifest hides a built-in Plugin
- [ ] Handler lookup tries the External folder first, then built-in, then the gitignored extensions folder
- [ ] Plugin and action ids keep the existing safe-character validation for External Plugins
- [ ] A missing or malformed External manifest is ignored without breaking the app
- [ ] A Plugin with no handler on disk stays unlisted
- [ ] Write Workflows from External Plugins still go through the write guard
- [ ] With no External folder, behaviour is unchanged
- [ ] Route tests (existing Workflows route suite, temp data folder) cover: listed, plan and run execute the handler, same-id External wins, `enabled: false` hides built-in, malformed manifest ignored, no-handler unlisted
