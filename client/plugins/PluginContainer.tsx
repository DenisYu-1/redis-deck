import { useEffect } from 'react';
import { usePlugins } from './usePlugins';
import type { PluginContext } from '@/types';
import type { PluginEventHandler } from './types';

interface PluginContainerProps {
    context: PluginContext;
}

export function PluginContainer({ context }: PluginContainerProps) {
    const { plugins, emit, isLoading } = usePlugins(context);

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
    const sortedPlugins = plugins.sort((a, b) => b.priority - a.priority);

    return (
        <div style={{ width: '100%' }}>
            {sortedPlugins.map((plugin) => {
                const Component = plugin.Component;
                return (
                    <div key={plugin.id} style={{ width: '100%', marginBottom: '1rem' }}>
                        <Component
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
                    </div>
                );
            })}
        </div>
    );
}
