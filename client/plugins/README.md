# Plugins (Workflows)

In v2 a plugin is a **manifest of Workflow actions** plus server-side handlers. There are no client-side plugin components, event bus or registry any more; the UI renders every Workflow generically from its manifest (`client/pages/Workflows/`).

## Config

- `config/config.json` (tracked): built-in plugins.
- `config/config.override.json` (gitignored, see `config.override.json.example`): private plugins and overrides. Merged by plugin `id`, override wins, `"enabled": false` disables.

The backend (`services/workflows.js`) reads both files; the frontend gets the merged list from `GET /api/workflows`.

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

Each action needs `services/workflows/<pluginId>/<actionId>.js` (private: gitignored `services/workflows/extensions/<pluginId>/<actionId>.js`):

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
