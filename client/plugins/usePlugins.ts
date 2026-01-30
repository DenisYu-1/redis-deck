import { useState, useEffect, useCallback } from 'react';
import type {
    Plugin,
    PluginDefinition,
    PluginEvent,
    PluginEventType,
    PluginHookResult
} from './types';
import type { PluginContext } from '@/types';
import { eventBus } from './eventBus';
import { pluginRegistry } from './pluginRegistry';

const pluginModules = import.meta.glob('./plugins/**/*.{tsx,jsx}', {
    eager: false
});

function normalizeConfigPath(configPath: string): string {
    let normalized = configPath.trim();
    if (normalized.startsWith('./')) {
        normalized = normalized.slice(2);
    }
    return normalized;
}

function findPluginModule(configPath: string): (() => Promise<any>) | null {
    const normalized = normalizeConfigPath(configPath);

    const possiblePaths = [
        `./plugins/${normalized}`,
        `./plugins/${normalized.replace(/\.(tsx|jsx|js)$/, '')}.tsx`,
        `./plugins/${normalized.replace(/\.(tsx|jsx|js)$/, '')}.jsx`,
        `./plugins/${normalized.replace(/\.(tsx|jsx|js)$/, '')}.js`
    ];

    for (const path of possiblePaths) {
        if (pluginModules[path]) {
            return pluginModules[path] as () => Promise<any>;
        }
    }

    const normalizedNoExt = normalized.replace(/\.(tsx|jsx|js)$/, '');
    for (const [globPath, importFn] of Object.entries(pluginModules)) {
        const globPathNoExt = globPath.replace(/\.(tsx|jsx|js)$/, '');
        if (
            globPathNoExt.endsWith(normalizedNoExt) ||
            globPath.endsWith(normalized)
        ) {
            return importFn as () => Promise<any>;
        }
    }

    return null;
}

async function importPlugin(configPath: string): Promise<any> {
    const importFn = findPluginModule(configPath);
    if (!importFn) {
        throw new Error(`Plugin module not found for path: ${configPath}`);
    }
    return await importFn();
}

export function usePlugins(context: PluginContext): PluginHookResult {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Emit event function
    const emit = useCallback((event: PluginEvent) => {
        eventBus.emit(event);
    }, []);

    // Forward events from event bus to plugins that have registered handlers
    useEffect(() => {
        const handleEventBusEvents = (event: PluginEvent) => {
            // Forward the event to all plugins that have registered handlers for this event type
            plugins.forEach((plugin) => {
                const handler = plugin.eventHandlers.get(event.type);
                if (handler) {
                    try {
                        handler(event);
                    } catch (error) {
                        console.error(
                            `Error in plugin ${plugin.id} event handler for ${event.type}:`,
                            error
                        );
                    }
                }
            });
        };

        // Subscribe to each event type that plugins have registered for
        const unsubscribers: (() => void)[] = [];
        const subscribedTypes = new Set<PluginEventType>();

        plugins.forEach((plugin) => {
            plugin.eventHandlers.forEach((_, eventType) => {
                if (!subscribedTypes.has(eventType)) {
                    subscribedTypes.add(eventType);
                    unsubscribers.push(
                        eventBus.on(eventType, handleEventBusEvents)
                    );
                }
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [plugins]);

    useEffect(() => {
        const loadPlugins = async () => {
            try {
                // Import config files directly since they're part of the build
                const baseConfig = await import('./config/config.json');
                let overrideConfig = null;

                try {
                    const overrideModule =
                        await import('./config/config.override.json');
                    overrideConfig = overrideModule.default;
                } catch {
                    console.log('No override config found');
                }

                const mergedConfig = mergeConfigs(
                    baseConfig.default as { plugins: PluginDefinition[] },
                    overrideConfig as { plugins: PluginDefinition[] } | null
                );
                const loadedPlugins = await Promise.all(
                    mergedConfig.plugins
                        .filter((p: PluginDefinition) => p.enabled)
                        .sort(
                            (a: PluginDefinition, b: PluginDefinition) =>
                                (b.priority || 0) - (a.priority || 0)
                        )
                        .map(async (pluginDef: PluginDefinition) => {
                            try {
                                const module = await importPlugin(
                                    pluginDef.path
                                );
                                const PluginComponent = module.default;

                                if (
                                    !PluginComponent ||
                                    typeof PluginComponent !== 'function'
                                ) {
                                    throw new Error(
                                        `Plugin ${pluginDef.id} must export a default React component`
                                    );
                                }

                                const plugin: Plugin = {
                                    id: pluginDef.id,
                                    name: pluginDef.name,
                                    priority: pluginDef.priority || 0,
                                    config: pluginDef.config || {},
                                    Component: PluginComponent,
                                    eventHandlers: new Map()
                                };

                                return plugin;
                            } catch (error: any) {
                                const isModuleNotFound =
                                    error?.message?.includes(
                                        'Failed to fetch'
                                    ) ||
                                    error?.message?.includes(
                                        'Cannot find module'
                                    ) ||
                                    error?.message?.includes(
                                        'Plugin module not found'
                                    ) ||
                                    error?.code === 'MODULE_NOT_FOUND';

                                if (isModuleNotFound) {
                                    const availablePaths = Object.keys(
                                        pluginModules
                                    )
                                        .slice(0, 10)
                                        .join(', ');
                                    console.warn(
                                        `Plugin ${pluginDef.id} not found at path "${pluginDef.path}". ` +
                                            `Available plugin paths: ${availablePaths}${Object.keys(pluginModules).length > 10 ? '...' : ''}`
                                    );
                                } else {
                                    console.error(
                                        `Failed to load plugin ${pluginDef.id}:`,
                                        error
                                    );
                                }
                                return null;
                            }
                        })
                );

                const validPlugins = loadedPlugins.filter(
                    (p): p is Plugin => p !== null
                );

                // Register plugins in the registry
                validPlugins.forEach((plugin) => {
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
        emit
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
