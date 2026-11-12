# External Plugins are loaded at runtime from the data folder

Public builds (Docker image, Desktop app) must not contain private Workflows, so Plugins can also be loaded from `$DATA_DIR/plugins/`: a `config.json` manifest plus `<pluginId>/<actionId>.js` handlers. The data folder already persists in both targets, so no new setting or mount is needed. External Plugins win over built-in ones on a Plugin id clash, and changes need a restart.

Alternative considered: bake private Plugins into each build. That ties them to the machine that builds the image or installer, which is the problem this solves.

Consequences: handlers are arbitrary JS executed by the backend, so anyone who can write to the data folder gets code execution as the app. That is the same trust as owning the machine, but the data volume must not be shared with other users. The base `docker-compose.yml` moves from the named volume `redis-ui-data` to a `./data:/app/data` bind mount so the folder is reachable. Reversing means shipping private Workflows through builds again.
