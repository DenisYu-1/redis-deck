import type { Plugin } from './types';

class PluginRegistry {
    private plugins = new Map<string, Plugin>();

    register(plugin: Plugin): void {
        this.plugins.set(plugin.id, plugin);
    }

    unregister(pluginId: string): void {
        this.plugins.delete(pluginId);
    }

    getPlugin(pluginId: string): Plugin | undefined {
        return this.plugins.get(pluginId);
    }

    getAllPlugins(): Plugin[] {
        return Array.from(this.plugins.values()).sort(
            (a, b) => b.priority - a.priority
        );
    }

    getPluginCount(): number {
        return this.plugins.size;
    }

    // Debug method to inspect current state
    debug(): {
        plugins: { id: string; name: string; priority: number }[];
        stats: { totalPlugins: number };
    } {
        const plugins = this.getAllPlugins().map((p) => ({
            id: p.id,
            name: p.name,
            priority: p.priority
        }));

        return {
            plugins,
            stats: {
                totalPlugins: this.getPluginCount()
            }
        };
    }

    // Clear all plugins (useful for hot reloading in development)
    clear(): void {
        this.plugins.clear();
    }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
