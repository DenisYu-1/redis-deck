import { usePlugins } from './usePlugins';
import type { PluginContext } from '@/types';

interface PluginContainerProps {
    context: PluginContext;
}

export function PluginContainer({ context }: PluginContainerProps) {
    const { plugins, isLoading } = usePlugins(context);

    if (isLoading) {
        return null;
    }

    return (
        <>
            {plugins.map((plugin) => {
                const { Component } = plugin;
                return <Component key={plugin.id} context={context} />;
            })}
        </>
    );
}
