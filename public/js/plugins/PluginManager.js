export class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.config = null;
    }

    async loadConfig() {
        try {
            const baseResponse = await fetch('/js/plugins/config.json');
            if (!baseResponse.ok) {
                throw new Error(`Failed to load base config: ${baseResponse.statusText}`);
            }
            const baseConfig = await baseResponse.json();

            let overrideConfig = null;
            try {
                const overrideResponse = await fetch('/js/plugins/config.override.json');
                if (overrideResponse.ok) {
                    overrideConfig = await overrideResponse.json();
                }
            } catch (overrideError) {
                console.log('No override config found, using base config only');
            }

            this.config = this.mergeConfigs(baseConfig, overrideConfig);
            return this.config;
        } catch (error) {
            console.error('Failed to load plugin config:', error);
            return { plugins: [] };
        }
    }

    mergeConfigs(baseConfig, overrideConfig) {
        if (!overrideConfig || !overrideConfig.plugins) {
            return baseConfig;
        }

        const pluginMap = new Map();
        
        baseConfig.plugins.forEach(plugin => {
            pluginMap.set(plugin.id, { ...plugin });
        });

        overrideConfig.plugins.forEach(plugin => {
            if (pluginMap.has(plugin.id)) {
                pluginMap.set(plugin.id, { ...pluginMap.get(plugin.id), ...plugin });
            } else {
                pluginMap.set(plugin.id, { ...plugin });
            }
        });

        return {
            ...baseConfig,
            plugins: Array.from(pluginMap.values())
        };
    }

    async loadAllPlugins(context) {
        await this.loadConfig();

        const enabled = this.config.plugins
            .filter(p => p.enabled)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const pluginConfig of enabled) {
            await this.loadPlugin(pluginConfig);
        }

        await this.initializePlugins(context);
    }

    async loadPlugin(pluginConfig) {
        try {
            const basePath = '/js/plugins/';
            const module = await import(basePath + pluginConfig.path);
            const PluginClass = module.default;

            if (!PluginClass) {
                throw new Error(`Plugin ${pluginConfig.id} must export a default class`);
            }

            const plugin = new PluginClass(pluginConfig);
            this.plugins.set(pluginConfig.id, plugin);
        } catch (error) {
            console.error(`✗ Failed to load plugin ${pluginConfig.id}:`, error);
        }
    }

    async initializePlugins(context) {
        const sorted = Array.from(this.plugins.values())
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const plugin of sorted) {
            try {
                await plugin.init(context);
            } catch (error) {
                console.error(`✗ Failed to initialize ${plugin.id}:`, error);
            }
        }
    }

    getPlugin(id) {
        return this.plugins.get(id);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    async unloadPlugin(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            await plugin.destroy();
            this.plugins.delete(id);
        }
    }
}


