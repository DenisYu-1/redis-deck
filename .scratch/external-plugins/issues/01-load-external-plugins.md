# 01: External Plugins load from the data folder

**What to build:** A user drops a manifest and handlers into a `plugins` folder inside the data folder, restarts, and the External Plugin's **Workflows** appear in the Workflows list and can be planned and run like any built-in one. See `.scratch/external-plugins/SPEC.md` and ADR 0003.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] External manifest is merged last by Plugin `id`, so it wins over the built-in manifest and the config override
- [x] `enabled: false` in the External manifest hides a built-in Plugin
- [x] Handler lookup tries the External folder first, then built-in, then the gitignored extensions folder
- [x] Plugin and action ids keep the existing safe-character validation for External Plugins
- [x] A missing or malformed External manifest is ignored without breaking the app
- [x] A Plugin with no handler on disk stays unlisted
- [x] Write Workflows from External Plugins still go through the write guard
- [x] With no External folder, behaviour is unchanged
- [x] Route tests (existing Workflows route suite, temp data folder) cover: listed, plan and run execute the handler, same-id External wins, `enabled: false` hides built-in, malformed manifest ignored, no-handler unlisted
