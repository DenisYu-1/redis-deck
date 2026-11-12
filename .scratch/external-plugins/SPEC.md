Status: ready-for-agent

# External Plugins loaded from the data folder

## Problem Statement

Private **Workflows** (manifest in the gitignored config override, handlers in the gitignored extensions folder) are only included in a Docker image or **Desktop app** when it is built on a machine that has those files. Public builds from CI or the GitHub Release never contain them. A user who installs a public build has no way to add their own Workflows afterwards.

## Solution

A **Plugin** can also be an **External Plugin**: loaded at runtime from a `plugins` folder inside the app's data folder, which already persists in Docker and the Desktop app. The user drops a manifest file and handler files there, restarts, and the Workflows appear in the UI like any other. Public builds stay clean and contain no private Workflows.

See ADR 0003 for the decision and its trust trade-off.

## User Stories

1. As a Docker user, I want to drop a manifest and handlers into the data folder, so that I can add Workflows without rebuilding the image.
2. As a Desktop app user, I want to drop a manifest and handlers into the app's data folder, so that I can add Workflows to a downloaded installer.
3. As a maintainer, I want public builds to contain no private Workflows, so that nothing private leaks into images or releases.
4. As a maintainer, I want private Workflows to survive app upgrades and image updates, so that I do not redo setup per release.
5. As a user, I want an External Plugin to appear in the Workflows UI exactly like a built-in one, so that I learn one interface.
6. As a user, I want External Workflows to honour Read-only and Confirm-writes Connections, so that custom code cannot bypass write protection.
7. As a user, I want an External Plugin with the same id as a built-in one to replace it, so that I can customise a shipped Workflow.
8. As a user, I want to disable a built-in Plugin by declaring it with `enabled: false` in the External manifest, so that I can hide Workflows I do not need.
9. As a user, I want a missing or malformed external manifest to be ignored without breaking the app, so that a typo does not take the server down.
10. As a user, I want a Plugin without a handler on disk to stay unlisted, so that the UI never shows an action that cannot run.
11. As a user, I want plugin and action ids restricted to safe characters, so that a crafted id cannot load files outside the plugins folder.
12. As a Docker user, I want the data folder to be a plain `./data` bind mount in the base compose file, so that I can reach `./data/plugins/` from the host.
13. As a Docker user, I want the README to explain the folder layout and that a restart is needed, so that I know how to add a Workflow.
14. As a Desktop app user, I want the README to give the data folder path per OS, so that I can find where to drop files.
15. As a security-minded user, I want the README to say handlers are arbitrary JS run by the backend, so that I do not share the data folder with untrusted users.
16. As a maintainer, I want the web, `yarn dev` and built-in Workflow flows unchanged when no External Plugins exist, so that existing behaviour is preserved.
17. As the maintainer with existing local data, I want the old named volume left untouched, so that I can copy my saved Connections over by hand.
18. As a maintainer, I want the GLOSSARY terms Plugin and External Plugin used consistently in docs and UI text, so that language stays aligned.

## Implementation Decisions

- External location is `plugins/` under the data folder (`DATA_DIR`, already set by the Desktop app and used by the Docker image). No new setting.
- Layout: a single `config.json` manifest (same schema as the built-in manifests) plus handler files per Plugin id and action id (same handler contract: `plan` and `run`).
- Manifest merge order, last wins by Plugin `id`: built-in manifest, config override, External manifest. `enabled: false` disables.
- Handler lookup order: External folder first, then built-in, then the gitignored extensions folder.
- Handlers are cached by Node `require`; changes need a restart. No file watcher.
- Id validation stays as is (letters, digits, `_`, `-`) and applies to External Plugins too.
- Frontend unchanged: it only consumes the merged list from the Workflows API.
- Write Workflows keep going through the write guard.
- The base compose file moves from a named volume to a `./data:/app/data` bind mount. The now-redundant data mount in the override compose file is removed.
- README gains an "External plugins" section: folder, layout, restart, per-OS data folder path, bind-mount note, arbitrary-code warning.
- ADR 0003 records the decision. GLOSSARY already defines Plugin and External Plugin.

## Testing Decisions

- A good test drives external behaviour through the real HTTP API and a temp data folder, not private functions.
- One seam: the Workflows route layer. Extend the existing route test for Workflows (it already drives list, plan and run with supertest).
- Cases: External Plugin listed in the Workflows list; its plan and run execute its handler; an External Plugin with a built-in's id replaces it; `enabled: false` in the External manifest hides a built-in; malformed manifest is ignored; Plugin with no handler is unlisted.
- No frontend, Electron or compose tests.

## Out of Scope

- Hot reload or a file watcher.
- An "Open plugins folder" menu item or in-app plugin management UI.
- One-folder-per-plugin layout with its own manifest.
- Sandboxing handlers or signing/verifying plugin code.
- Automatic migration of the old named Docker volume.
- Client-side (UI) plugin code.

## Further Notes

- Existing users: only the maintainer. The old `redis-ui-data` volume stays in Docker unused; copy its contents to `./data` manually if the saved Connections are wanted.
- Handler loading uses `require` of user-supplied files, so anyone able to write to the data folder gets code execution as the app. Documented in ADR 0003 and the README.
