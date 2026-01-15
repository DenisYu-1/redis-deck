# Redis UI Plugin System

A modern, React-based plugin system for the Redis UI that supports event-driven communication, configuration-based plugin management, and seamless integration with the main application.

## Architecture Overview

### Key Features

1. **React-based**: All plugins are React components with full TypeScript support
2. **Event-driven**: Plugins communicate through a centralized event bus
3. **Configuration-controlled**: Plugin enable/disable and positioning controlled via JSON config
4. **Target-based rendering**: Plugins render in specific application areas based on configuration
5. **Priority-based ordering**: Plugins are ordered by priority within their target areas

### Core Components

- **EventBus**: Centralized pub/sub system for plugin communication
- **PluginRegistry**: Manages plugin instances and provides lookup by target
- **PluginContainer**: React component that renders plugins for specific targets
- **usePlugins**: React hook that loads and manages plugins

## Plugin Configuration

Plugins are configured in `client/plugins/config/config.json` and loaded via ES module imports:

```json
{
  "plugins": [
    {
      "id": "batch-delete",
      "name": "Batch Delete Keys",
      "enabled": true,
      "path": "batchDelete/batchDelete.tsx",
      "priority": 50,
      "config": {}
    }
  ]
}
```

### Configuration Fields

- `id`: Unique plugin identifier
- `name`: Human-readable plugin name
- `enabled`: Whether the plugin is active
- `path`: Path to the plugin module (must match a key in the plugin imports registry)
- `priority`: Higher numbers = higher priority (rendered first)
- `config`: Plugin-specific configuration object

## Creating a Plugin

### Basic Plugin Structure

```tsx
import React, { useEffect } from 'react';
import type { PluginComponentProps } from '../types';

const MyPlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    useEffect(() => {
        // Listen for events
        const unsubscribe = on('some:event', (event) => {
            console.log('Received event:', event);
        });

        return unsubscribe; // Cleanup on unmount
    }, [on]);

    const handleAction = () => {
        // Emit events to communicate with other plugins
        emit({
            type: 'my:action',
            payload: { data: 'example' },
            source: 'my-plugin'
        });
    };

    return (
        <div className="my-plugin">
            <h4>My Plugin</h4>
            <button onClick={handleAction}>Do Something</button>
        </div>
    );
};

export default MyPlugin;
```

### Plugin Props

- `context`: Application context with methods like `getCurrentEnvironment()`, `showToast()`
- `emit`: Function to emit events to other plugins
- `on`: Function to subscribe to events (returns unsubscribe function)

## Event System

### Built-in Events

- `keys:deleted` - Keys were deleted
- `keys:selected` - Keys were selected
- `environment:changed` - Current environment changed
- `operation:completed` - An operation finished
- `toast:show` - Show a toast notification
- `plugin:initialized` - Plugin system initialized
- `news-feed:add` - Add news feed item for a user

### Events Supported by Default Plugins

The default plugins emit and listen to the following events:

#### Batch Delete Plugin (`batch-delete`)
**Emits:**
- `keys:deleted` - When keys are requested for deletion
- `toast:show` - For user feedback messages
- `operation:completed` - When deletion operation is finished

**Listens:**
- `keys:deleted` - To show feedback when keys are deleted by other plugins

#### Key Operations Plugin (`key-operations`)
**Emits:**
- `keys:selected` - When keys are selected for operations
- `keys:deleted` - When keys are deleted through the UI
- `toast:show` - For success/error messages
- `operation:completed` - When operations finish

**Listens:**
- `keys:selected` - To update selected keys state
- `operation:completed` - To refresh UI after operations

### Custom Events

Plugins can define and use custom events. Event types should follow the pattern `namespace:action`.

### Event Structure

```typescript
interface PluginEvent {
    type: PluginEventType;
    payload?: Record<string, unknown>;
    source?: string;
}
```

## Using Plugins in Components

### Basic Usage

```tsx
import { PluginContainer } from './plugins/PluginContainer';

function KeyListPage({ context }) {
    return (
        <div>
            <PluginContainer context={context} target="key-list" />
            {/* Your main content here */}
            <KeyList />
            <PluginContainer context={context} target="key-list" position="after" />
        </div>
    );
}
```

### Using the Hook

```tsx
import { usePlugins } from './plugins/usePlugins';

function MyComponent({ context }) {
    const { plugins, emit, getPluginsForTarget, isLoading } = usePlugins(context);

    if (isLoading) return <div>Loading plugins...</div>;

    const keyListPlugins = getPluginsForTarget('key-list');

    return (
        <div>
            {keyListPlugins.map(plugin => (
                <plugin.Component
                    key={plugin.id}
                    context={context}
                    emit={emit}
                    on={(type, handler) => {
                        // Plugin event subscription
                        plugin.eventHandlers.set(type, handler);
                        return () => plugin.eventHandlers.delete(type);
                    }}
                />
            ))}
        </div>
    );
}
```

## Plugin Development Best Practices

1. **Event-driven Communication**: Use events instead of direct method calls
2. **Proper Cleanup**: Always unsubscribe from events in useEffect cleanup
3. **Type Safety**: Use TypeScript interfaces for event payloads
4. **Error Handling**: Wrap event handlers and async operations in try-catch
5. **Consistent Naming**: Use kebab-case for plugin IDs and event types
6. **Documentation**: Document custom events and configuration options

## Migration from Old System

The old system used DOM manipulation and vanilla JavaScript. The new system:

- Converts plugins to React components
- Uses event bus instead of direct method calls
- Supports TypeScript throughout
- Provides better error handling and debugging
- Enables proper React lifecycle management

### Migration Steps

1. Convert plugin class to React functional component
2. Replace DOM manipulation with React state and JSX
3. Use `emit()` and `on()` for communication
4. Update config to use `.tsx` extension and new fields
5. Test plugin in isolation and with other plugins

## Debugging

### Plugin Registry Debug

```javascript
import { pluginRegistry } from './plugins/pluginRegistry';

// Get detailed plugin information
console.log(pluginRegistry.debug());
```

### Event Bus Debug

```javascript
import { eventBus } from './plugins/eventBus';

// See active event subscriptions
console.log('Event handlers:', eventBus.getHandlerCount());
console.log('Subscribed events:', eventBus.getSubscribedEvents());
```

## Override Configuration

Create `client/plugins/config/config.override.json` to customize plugins without modifying the base config (loaded via ES module imports):

```json
{
  "plugins": [
    {
      "id": "batch-delete",
      "enabled": false
    },
    {
      "id": "custom-searches",
      "enabled": true,
      "priority": 100,
      "config": {
        "searchLimit": 200
      }
    }
  ]
}
```

This allows users to enable/disable plugins and customize settings without touching the base configuration.
