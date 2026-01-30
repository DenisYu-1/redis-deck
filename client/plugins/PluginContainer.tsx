import { useEffect } from 'react';
import type { PluginContext } from '@/types';
import type { Plugin, PluginEventHandler, PluginEvent } from './types';

interface PluginContainerProps {
    context: PluginContext;
    plugins: Plugin[];
    emit: (event: PluginEvent) => void;
    isLoading: boolean;
}

export function PluginContainer({
    context,
    plugins,
    emit,
    isLoading
}: PluginContainerProps) {
    useEffect(() => {
        // Emit initialization event when plugins are loaded
        if (!isLoading && plugins.length > 0) {
            emit({
                type: 'plugin:initialized',
                payload: { pluginCount: plugins.length },
                source: 'PluginContainer'
            });
        }
    }, [isLoading, plugins.length, emit]);

    if (isLoading) {
        return null;
    }

    // Sort plugins by priority (higher priority first)
    const sortedPlugins = [...plugins].sort((a, b) => b.priority - a.priority);

    return (
        <div style={{ width: '100%' }}>
            {sortedPlugins.map((plugin) => {
                const Component = plugin.Component;
                return (
                    <div
                        key={plugin.id}
                        id={`plugin-section-${plugin.id}`}
                        data-plugin-id={plugin.id}
                        style={{ width: '100%', marginBottom: '1rem' }}
                    >
                        <Component
                            context={context}
                            emit={emit}
                            on={(
                                eventType: string,
                                handler: PluginEventHandler
                            ) => {
                                // Plugin can register event handlers
                                plugin.eventHandlers.set(
                                    eventType as any,
                                    handler
                                );
                                // Return unsubscribe function
                                return () => {
                                    plugin.eventHandlers.delete(
                                        eventType as any
                                    );
                                };
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
