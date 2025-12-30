import type { PluginContext } from '@/types';

export interface PluginDefinition {
    id: string;
    name: string;
    enabled: boolean;
    path: string;
    priority: number;
    config?: Record<string, unknown>;
}

export interface Plugin {
    id: string;
    name: string;
    priority: number;
    config: Record<string, unknown>;
    Component: React.ComponentType<PluginComponentProps>;
}

export interface PluginComponentProps {
    context: PluginContext;
}
