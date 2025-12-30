import React, { useState, useEffect } from 'react';
import type { Plugin, PluginDefinition } from './types';
import type { PluginContext } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function usePlugins(_context: PluginContext) {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPlugins = async () => {
            try {
                const baseResponse = await fetch(
                    '/public/plugins/config/config.json'
                );
                if (!baseResponse.ok) {
                    throw new Error('Failed to load plugin config');
                }
                const baseConfig = await baseResponse.json();

                let overrideConfig = null;
                try {
                    const overrideResponse = await fetch(
                        '/public/plugins/config/config.override.json'
                    );
                    if (overrideResponse.ok) {
                        overrideConfig = await overrideResponse.json();
                    }
                } catch {
                    console.log('No override config found');
                }

                const mergedConfig = mergeConfigs(baseConfig, overrideConfig);
                const loadedPlugins = await Promise.all(
                    mergedConfig.plugins
                        .filter((p: PluginDefinition) => p.enabled)
                        .sort(
                            (a: PluginDefinition, b: PluginDefinition) =>
                                (b.priority || 0) - (a.priority || 0)
                        )
                        .map(async (pluginDef: PluginDefinition) => {
                            try {
                                // Dynamically import the plugin module
                                const basePath = '/public/plugins/plugins/';
                                const module = await import(basePath + pluginDef.path);
                                const PluginClass = module.default;

                                if (!PluginClass) {
                                    throw new Error(
                                        `Plugin ${pluginDef.id} must export a default class`
                                    );
                                }

                                // Create a React component that wraps the DOM-based plugin
                                const PluginComponent = () => {
                                    return React.createElement(
                                        'div',
                                        {
                                            id: `plugin-${pluginDef.id}-container`,
                                            className: `plugin-container plugin-${pluginDef.id}`,
                                            'data-plugin-id': pluginDef.id
                                        }
                                    );
                                };

                                const plugin: Plugin = {
                                    id: pluginDef.id,
                                    name: pluginDef.name,
                                    priority: pluginDef.priority,
                                    config: pluginDef.config || {},
                                    Component: PluginComponent
                                };

                                // Store the plugin class for later initialization
                                (plugin as any).PluginClass = PluginClass;
                                (plugin as any).pluginConfig = pluginDef;

                                return plugin;
                            } catch (error) {
                                console.error(
                                    `Failed to load plugin ${pluginDef.id}:`,
                                    error
                                );
                                return null;
                            }
                        })
                );

                const validPlugins = loadedPlugins.filter(
                    (p): p is Plugin => p !== null
                );
                setPlugins(validPlugins);
            } catch (error) {
                console.error('Failed to load plugins:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void loadPlugins();
    }, []);

    return { plugins, isLoading };
}

function mergeConfigs(
    baseConfig: { plugins: PluginDefinition[] },
    overrideConfig: { plugins: PluginDefinition[] } | null
): { plugins: PluginDefinition[] } {
    if (!overrideConfig?.plugins) {
        return baseConfig;
    }

    const pluginMap = new Map<string, PluginDefinition>();

    baseConfig.plugins.forEach((plugin) => {
        pluginMap.set(plugin.id, { ...plugin });
    });

    overrideConfig.plugins.forEach((plugin) => {
        if (pluginMap.has(plugin.id)) {
            pluginMap.set(plugin.id, {
                ...pluginMap.get(plugin.id)!,
                ...plugin
            });
        } else {
            pluginMap.set(plugin.id, { ...plugin });
        }
    });

    return {
        ...baseConfig,
        plugins: Array.from(pluginMap.values())
    };
}
