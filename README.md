<img src="client/assets/logo.svg" alt="RedisDeck Logo" width="500">

A minimalistic web UI for Redis clusters that uses redis-cli under the hood. Workflows let you add custom, guarded flows.

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
- 🔄 **Drag & Drop**: Reorder connections

### **Plugin System**

- 🧩 **Workflows**: Config-declared actions with typed inputs, dry-run plan and run history
- 🛡️ **Server-enforced safety**: Read-only and confirm-writes connections are enforced by the backend
- 🔧 **Easy Integration**: A handler module per action

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

Comprehensive monitoring and analytics available at `/stats`:

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
- **Workflows**: Config-declared plugin actions with server-side handlers
- **Backend**: Node.js with Express and comprehensive REST API
- **Type Safety**: Strict TypeScript configuration with comprehensive type checking
- **Code Quality**: ESLint with TypeScript and React plugins, Prettier for formatting
- **Testing**: Jest with React Testing Library and functional database tests
- **Database**: SQLite for connection management and statistics storage
- Redis commands are executed using redis-cli under the hood
- Credentials passed via environment variables for security

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.

## Workflows (plugins)

Plugins contribute **Workflows**: named actions with typed inputs, a dry-run plan, a run, and per-connection run history. Handlers run on the Express server, so Read-only / Confirm-writes connections are enforced there (see `docs/adr/0001-server-side-workflows-and-enforced-read-only.md`). Workflows appear in the sidebar and open at `/workflows/<pluginId>.<actionId>`.

### Configuration

- **`client/plugins/config/config.json`** (tracked): built-in plugins (currently the `examples` plugin).
- **`client/plugins/config/config.override.json`** (gitignored): your own plugins. Entries merge by plugin `id`; override wins; `"enabled": false` disables one.

```bash
cp client/plugins/config/config.override.json.example client/plugins/config/config.override.json
```

### Adding a Workflow

1. Declare the plugin and its `actions` (id, title, desc, `writes`, `inputs`) in the config. Input types include `int`, `uuid`, `select`, and more; see `config.json` for examples.
2. Add a handler module `services/workflows/<pluginId>/<actionId>.js` (private ones go in the gitignored `services/workflows/extensions/<pluginId>/`) exporting:

```js
module.exports = {
    async plan(inputs, ctx) { return { text: 'Would do X' }; },
    async run(inputs, ctx) { await ctx.exec('SET k v'); return { text: 'Did X' }; }
};
```

See `services/workflows/examples/` for working examples. Actions with `"writes": true` are refused on Read-only connections.
