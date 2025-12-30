import { useState, useEffect, useCallback } from 'react';
import type { Plugin, PluginDefinition, PluginEvent, PluginHookResult } from './types';
import type { PluginContext } from '@/types';
import { eventBus } from './eventBus';
import { pluginRegistry } from './pluginRegistry';

export function usePlugins(context: PluginContext): PluginHookResult {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Emit event function
    const emit = useCallback((event: PluginEvent) => {
        eventBus.emit(event);
    }, []);

    // Get plugins for a specific target/area
    const getPluginsForTarget = useCallback((target: string): Plugin[] => {
        return plugins
            .filter(plugin => plugin.target === target)
            .sort((a, b) => b.priority - a.priority);
    }, [plugins]);

    useEffect(() => {
        const loadPlugins = async () => {
            try {
                const baseResponse = await fetch('/public/plugins/config/config.json');
                if (!baseResponse.ok) {
                    throw new Error('Failed to load plugin config');
                }
                const baseConfig = await baseResponse.json();

                let overrideConfig = null;
                try {
                    const overrideResponse = await fetch('/public/plugins/config/config.override.json');
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
                        .sort((a: PluginDefinition, b: PluginDefinition) => (b.priority || 0) - (a.priority || 0))
                        .map(async (pluginDef: PluginDefinition) => {
                            try {
                                // Import the plugin module (now expecting React components)
                                const basePath = '/public/plugins/plugins/';
                                const module = await import(basePath + pluginDef.path);
                                const PluginComponent = module.default;

                                if (!PluginComponent || typeof PluginComponent !== 'function') {
                                    throw new Error(`Plugin ${pluginDef.id} must export a default React component`);
                                }

                                const plugin: Plugin = {
                                    id: pluginDef.id,
                                    name: pluginDef.name,
                                    priority: pluginDef.priority || 0,
                                    position: pluginDef.position || 'after',
                                    target: pluginDef.target || 'main',
                                    config: pluginDef.config || {},
                                    Component: PluginComponent,
                                    eventHandlers: new Map()
                                };

                                return plugin;
                            } catch (error) {
                                console.error(`Failed to load plugin ${pluginDef.id}:`, error);
                                return null;
                            }
                        })
                );

                const validPlugins = loadedPlugins.filter((p): p is Plugin => p !== null);

                // Register plugins in the registry
                validPlugins.forEach(plugin => {
                    pluginRegistry.register(plugin);
                });

                setPlugins(validPlugins);
            } catch (error) {
                console.error('Failed to load plugins:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void loadPlugins();
    }, []);

    // Subscribe to context events and forward them to plugins
    useEffect(() => {
        if (!context) return;

        // Bridge context methods to events
        const originalShowToast = context.showToast;
        const originalOnOperationComplete = context.onOperationComplete;

        // Override context methods to emit events
        (context as any).showToast = (message: string, type: string) => {
            emit({
                type: 'toast:show',
                payload: { message, type },
                source: 'context'
            });
            return originalShowToast(message, type as any);
        };

        (context as any).onOperationComplete = () => {
            emit({
                type: 'operation:completed',
                source: 'context'
            });
            return originalOnOperationComplete();
        };

        // Cleanup function to restore original methods
        return () => {
            (context as any).showToast = originalShowToast;
            (context as any).onOperationComplete = originalOnOperationComplete;
        };
    }, [context, emit]);

    return {
        plugins,
        isLoading,
        emit,
        getPluginsForTarget
    };
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
        pluginMap.set(plugin.id, {
            ...plugin,
            position: plugin.position || 'after',
            target: plugin.target || 'main'
        });
    });

    overrideConfig.plugins.forEach((plugin) => {
        if (pluginMap.has(plugin.id)) {
            pluginMap.set(plugin.id, {
                ...pluginMap.get(plugin.id)!,
                ...plugin
            });
        } else {
            pluginMap.set(plugin.id, {
                ...plugin,
                position: plugin.position || 'after',
                target: plugin.target || 'main'
            });
        }
    });

    return {
        ...baseConfig,
        plugins: Array.from(pluginMap.values())
    };
}
