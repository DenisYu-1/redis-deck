<img src="public/logo.svg" alt="RedisDeck Logo" width="500">

A minimalistic web UI for Redis clusters that uses redis-cli under the hood. Plugin system allows adding custom flows and commands.

## Features

### **Core Functionality**

- 🔍 **Search & Browse**: Pattern-based key search with pagination
- 📊 **Key Management**: View, edit, delete, rename, and copy keys across environments
- 🔄 **Key Refresh**: Refresh individual key data without affecting search input
- ⏱️ **TTL Management**: Set and modify time-to-live for keys
- 🗑️ **Batch Operations**: Bulk delete keys by pattern
- 🌐 **Multi-Environment**: Switch between multiple Redis connections
- 📋 **Value Viewer**: Dual-mode value display (formatted JSON tree view and raw text)
- 📈 **Statistics Dashboard**: Comprehensive metrics, trends, and analytics

### **User Experience**

- 🌓 **Dark Mode**: Fully-implemented dark theme with smooth transitions
- 🎨 **Modern UI**: Clean, responsive interface with polished interactions
- 🎯 **Empty State**: Helpful onboarding when no connections are configured
- 💾 **Import/Export**: Backup and restore connection configurations
- 🔄 **Drag & Drop**: Reorder connections in settings

### **Plugin System**

- 🧩 **Extensible Architecture**: Config-based plugin system
- ⚡ **Built-in Plugins**: Custom searches, booking management, batch operations
- 🔧 **Easy Integration**: Simple plugin development with base classes

## Quick Start

### Running with Docker

1. Clone the repository
2. Start the application:
    ```bash
    docker compose up -d
    ```
3. Access the UI at http://localhost:2222
4. Go to Settings (⚙️) to add your Redis connections

### Running Locally (Development)

1. Clone the repository
2. Install dependencies:
    ```bash
    yarn install
    ```
3. Start the development server:
    ```bash
    yarn dev
    ```
   This will start:
   - Vite dev server at http://localhost:5173 (frontend)
   - Node.js backend at http://localhost:3000 (API)
   - Vite proxies API calls to the backend automatically

4. Open http://localhost:5173
5. Go to Settings (⚙️) to add your Redis connections

## Key Features in Detail

### Connection Management

**Multiple Environments**: Manage multiple Redis connections with easy switching

- Add, edit, delete connections from the Settings page
- Test connections before saving
- Support for TLS/SSL and Redis Cluster mode
- Drag and drop to reorder connections
- Import/Export connection configurations as JSON

**Import/Export**:

```bash
# Export all connections
GET /api/connections/export

# Import connections
POST /api/connections/import
```

### Theme Support

RedisDeck includes a complete dark mode implementation:

- Toggle theme from Settings page
- Smooth transitions between themes
- Persistent preference (localStorage)
- All components and plugins fully themed

### Value Visualization

Enhanced value viewer with two display modes:

- **Tree View**: Interactive JSON tree for structured data
- **Formatted View**: Syntax-highlighted raw view

Supports all Redis data types:

- Strings (with JSON detection)
- Hashes
- Lists
- Sets
- Sorted Sets

### Statistics Dashboard

Comprehensive monitoring and analytics available at `/statistics`:

**Real-Time Metrics (12 KPIs)**:

- Memory usage with visual progress bar and peak tracking
- Total keys count across all databases
- Cache hit rate with hits/misses breakdown
- Connected clients and total connections received
- Evicted and expired keys tracking
- Memory fragmentation ratio with health indicators
- Operations per second (current throughput)
- CPU usage (system + user time)
- Network I/O (total input/output bytes)
- Keys with TTL vs without TTL analysis

**Historical Trends (5 Interactive Charts)**:

- Memory usage trend with peak overlay
- Total keys growth over time
- Cache hit rate evolution
- Operations per second activity
- Network I/O bandwidth usage
- Time ranges: 1H, 6H, 24H, 7D, 30D

**Advanced Analytics**:

- **Command Statistics**: Top commands by frequency with execution time analysis
- **Slow Query Log**: Recent slow operations with duration and timestamps
- **Memory Breakdown by Pattern**: Intelligent pattern detection and memory analysis
    - Smart pattern recognition (handles UUIDs, numeric IDs, hashes)
    - Fast mode: Key count distribution (1-2 seconds)
    - Memory mode: Exact memory usage via pipelining (~20 seconds for 200 keys)
    - Configurable sampling (100-1000 keys)
    - Visual pie chart and detailed breakdown table

**Data Collection**:

- Automatic snapshots every 5 minutes
- 30-day data retention with automatic cleanup
- Manual snapshot trigger available
- SQLite storage for historical data

**Features**:

- Auto-refresh every 30 seconds
- Environment-specific statistics
- Dark mode support
- Responsive charts with Chart.js
- Export-ready metrics

## Technical Details

- **Frontend**: React 18 with TypeScript and modern hooks
- **Build Tool**: Vite for fast development and optimized production builds
- **State Management**: Zustand for lightweight, hook-based state management
- **Plugin System**: Extensible React-based plugin architecture
- **Backend**: Node.js with Express and comprehensive REST API
- **Type Safety**: Strict TypeScript configuration with comprehensive type checking
- **Code Quality**: ESLint with TypeScript and React plugins, Prettier for formatting
- **Testing**: Jest with React Testing Library and functional database tests
- **Database**: SQLite for connection management and statistics storage
- Redis commands are executed using redis-cli under the hood
- Credentials passed via environment variables for security

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.

## Plugin System

RedisDeck includes a flexible plugin system that allows you to extend the UI with custom functionality. The plugin system is built with React and TypeScript, allowing you to create type-safe, reusable components that integrate seamlessly with the main application.

### Setup

The plugin system uses a base configuration with optional overrides:

- **`client/plugins/config/config.json`** (tracked in git): Base configuration with built-in plugins
- **`client/plugins/config/config.override.json`** (gitignored): Optional file to add custom plugins or override base settings

To add your own plugins, create an override file:

```bash
cp client/plugins/config/config.override.json.example client/plugins/config/config.override.json
```

Then customize `config.override.json` to add your custom plugins. The override file can:

- Add new plugins
- Override existing plugin settings by matching the plugin `id`
- Disable built-in plugins by setting `"enabled": false`

### Architecture

The plugin system consists of:

- **Plugin Registry**: Manages plugin loading and initialization
- **Plugin Components**: React components that integrate with the main UI
- **Event System**: Pub/sub system for inter-plugin communication
- **Configuration**: JSON-based configuration for plugin registration
- **TypeScript Types**: Comprehensive type definitions for plugin development

### Creating a New Plugin

#### 1. Create Plugin Directory Structure

Create a new directory for your plugin:

**For custom/private plugins** (not tracked in git):

```
client/plugins/plugins/extensions/your-plugin/
├── yourPlugin.tsx
├── components/
└── hooks/
```

**For built-in plugins** (tracked in git):

```
client/plugins/plugins/your-plugin/
├── yourPlugin.tsx
├── components/
├── hooks/
└── utils/
```

#### 2. Create Plugin Components

Create your plugin components using React and TypeScript. Create a main plugin file `yourPlugin.tsx`:

```tsx
import React from 'react';
import { PluginComponentProps } from '../../types';

const YourPlugin: React.FC<PluginComponentProps> = ({
    context,
    emit,
    on
}) => {
    const handleAction = () => {
        // Your plugin logic here
        emit({
            type: 'toast:show',
            payload: { message: 'Action completed!', type: 'success' }
        });
    };

    return (
        <section className="your-plugin-section">
            <h2>Your Plugin Title</h2>
            <div className="form-group">
                <label htmlFor="your-input">Input Label:</label>
                <input
                    type="text"
                    id="your-input"
                    placeholder="Enter value"
                />
            </div>
            <button
                className="secondary-btn"
                onClick={handleAction}
            >
                Execute Action
            </button>
        </section>
    );
};

export default YourPlugin;
```

#### 4. Register the Plugin

**For custom extension plugins**, add to `client/plugins/config/config.override.json`:

```json
{
    "plugins": [
        {
            "id": "your-plugin",
            "name": "Your Plugin",
            "enabled": true,
            "path": "extensions/yourPlugin/yourPlugin.tsx",
            "priority": 10,
            "config": {
                "someSetting": "value"
            }
        }
    ]
}
```

**For built-in plugins**, add directly to `client/plugins/config/config.json`:

```json
{
    "plugins": [
        {
            "id": "your-plugin",
            "name": "Your Plugin",
            "enabled": true,
            "path": "yourPlugin/yourPlugin.tsx",
            "priority": 10,
            "config": {
                "someSetting": "value"
            }
        }
    ]
}
```

**Configuration Options:**

- `id`: Unique plugin identifier
- `name`: Display name for the plugin
- `enabled`: Set to `false` to disable the plugin
- `path`: Path to the plugin module (relative to `/js/plugins/`)
- `priority`: Display order (higher numbers load first)
- `config`: Plugin-specific configuration (accessible via `this.config`)

### Plugin Context

The `context` object passed to plugins provides access to:

- `context.getCurrentEnvironment()`: Get the currently selected environment ID
- `context.onOperationComplete()`: Callback to refresh the UI after operations
- `context.showToast(message, type)`: Display toast notifications

### Available APIs

**API Service** (`client/services/apiService.ts`):

- `searchKeys(pattern, cursor, count, environment)` - Search for keys by pattern
- `getKeyDetails(key, environment)` - Get details for a specific key
- `saveKey(key, value, expiry, environment)` - Save or update a key
- `deleteKey(key, environment)` - Delete a key
- `addToSortedSet(key, members, expiry, environment)` - Add to sorted set

**Toast Service** (`client/hooks/useToast.ts`):

- `showToast(message, type)` - Display toast notification (types: 'success', 'error', 'warning')
- `escapeHTML(str)` - Escape HTML special characters

### Managing Plugins

To customize built-in plugins or add your own, use `client/plugins/config/config.override.json`:

**Disable a Built-in Plugin:**

```json
{
    "plugins": [
        {
            "id": "batch-delete",
            "enabled": false
        }
    ]
}
```

**Override Plugin Settings:**

```json
{
    "plugins": [
        {
            "id": "key-operations",
            "config": {
                "timeout": 5000,
                "maxRetries": 3
            }
        }
    ]
}
```

**Add Custom Plugin:**

```json
{
    "plugins": [
        {
            "id": "your-plugin",
            "name": "Your Plugin",
            "enabled": true,
            "path": "extensions/yourPlugin/yourPlugin.tsx",
            "priority": 10,
            "config": {}
        }
    ]
}
```

Access configuration in your plugin via `this.config.timeout`.

### Built-in Plugins

- **Key Operations** (priority: 100): Common key operations (TTL, rename, copy, delete)
- **Batch Delete** (priority: 50): Bulk delete operations by pattern

### Styling

Plugins inherit the application's CSS. Use existing classes for consistent styling:

- `.form-group` - Form field wrapper
- `.secondary-btn` - Secondary button style
- `.danger-btn` - Danger/delete button style
