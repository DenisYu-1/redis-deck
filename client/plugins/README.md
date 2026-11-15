# Plugins (Workflows)

In v2 a plugin is a **manifest of Workflow actions** plus server-side handlers. There are no client-side plugin components, event bus or registry any more; the UI renders every Workflow generically from its manifest (`client/pages/Workflows/`).

## Config

- `config/config.json` (tracked): built-in plugins.
- `config/config.override.json` (gitignored, see `config.override.json.example`): private plugins and overrides. Merged by plugin `id`, override wins, `"enabled": false` disables.

- `$DATA_DIR/plugins/config.json` (External Plugins, loaded at runtime from the data folder; handlers in `$DATA_DIR/plugins/<pluginId>/<actionId>.js`). Merged last, so it wins. Use this to add Workflows to a Docker image or Desktop app without rebuilding; see [External plugins](../../README.md#external-plugins).

The backend (`services/workflows.js`) reads all three files; the frontend gets the merged list from `GET /api/workflows`.

```json
{
    "plugins": [
        {
            "id": "examples",
            "name": "Examples",
            "enabled": true,
            "priority": 10,
            "actions": [
                {
                    "id": "set-marker",
                    "title": "Set marker key",
                    "desc": "Shown under the title",
                    "writes": true,
                    "inputs": [
                        {
                            "name": "id",
                            "label": "Marker id",
                            "type": "int",
                            "required": true
                        }
                    ]
                }
            ]
        }
    ]
}
```

- `writes: true` actions are refused on Read-only connections and need confirmation on Confirm-writes connections.
- Input types: `int`, `uuid`, `select` (with `options`), and the other types in `client/utils/workflowInputs.ts`.

## Handlers

Each action needs `<pluginId>/<actionId>.js` in `$DATA_DIR/plugins/` (External), `services/workflows/` (built-in) or gitignored `services/workflows/extensions/` (private), looked up in that order:

```js
module.exports = {
    async plan(inputs, ctx) {
        return { text: 'Would do X' };
    }, // dry run, must not write
    async run(inputs, ctx) {
        await ctx.exec('SET k v');
        return { text: 'Did X' };
    }
};
```

Examples: `services/workflows/examples/`.

## Routes

`/workflows/<pluginId>.<actionId>` in the UI. API: `GET /api/workflows`, `POST /api/workflows/:id/plan`, `POST /api/workflows/:id/run`, `GET /api/workflows/:id/history`.
