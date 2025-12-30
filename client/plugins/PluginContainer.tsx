import { useEffect } from 'react';
import { usePlugins } from './usePlugins';
import type { PluginContext } from '@/types';
import type { PluginEventHandler } from './types';

interface PluginContainerProps {
    context: PluginContext;
    target?: string;
}

export function PluginContainer({ context, target = 'main' }: PluginContainerProps) {
    const { getPluginsForTarget, emit, isLoading } = usePlugins(context);

    const targetPlugins = getPluginsForTarget(target);

    useEffect(() => {
        // Emit initialization event when plugins are loaded
        if (!isLoading && targetPlugins.length > 0) {
            emit({
                type: 'plugin:initialized',
                payload: { target, pluginCount: targetPlugins.length },
                source: 'PluginContainer'
            });
        }
    }, [isLoading, targetPlugins.length, target, emit]);

    if (isLoading) {
        return null;
    }

    // Group plugins by position
    const beforePlugins = targetPlugins.filter(p => p.position === 'before');
    const afterPlugins = targetPlugins.filter(p => p.position === 'after');
    const replacePlugins = targetPlugins.filter(p => p.position === 'replace');

    // If there are replace plugins, only render them
    if (replacePlugins.length > 0) {
        return (
            <>
                {replacePlugins.map((plugin) => {
                    const Component = plugin.Component;
                    return (
                        <Component
                            key={plugin.id}
                            context={context}
                            emit={emit}
                            on={(eventType: string, handler: PluginEventHandler) => {
                                // Plugin can register event handlers
                                plugin.eventHandlers.set(eventType as any, handler);
                                // Return unsubscribe function
                                return () => {
                                    plugin.eventHandlers.delete(eventType as any);
                                };
                            }}
                        />
                    );
                })}
            </>
        );
    }

    // Otherwise render before + after plugins
    return (
        <>
            {beforePlugins.map((plugin) => {
                const Component = plugin.Component;
                return (
                    <Component
                        key={plugin.id}
                        context={context}
                        emit={emit}
                        on={(eventType: string, handler: PluginEventHandler) => {
                            plugin.eventHandlers.set(eventType as any, handler);
                            return () => {
                                plugin.eventHandlers.delete(eventType as any);
                            };
                        }}
                    />
                );
            })}
            {/* Main content would go here */}
            {afterPlugins.map((plugin) => {
                const Component = plugin.Component;
                return (
                    <Component
                        key={plugin.id}
                        context={context}
                        emit={emit}
                        on={(eventType: string, handler: PluginEventHandler) => {
                            plugin.eventHandlers.set(eventType as any, handler);
                            return () => {
                                plugin.eventHandlers.delete(eventType as any);
                            };
                        }}
                    />
                );
            })}
        </>
    );
}
