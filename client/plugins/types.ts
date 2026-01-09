import type { PluginContext } from '@/types';

// Event system types
export type PluginEventType =
    | 'keys:deleted'
    | 'keys:selected'
    | 'environment:changed'
    | 'operation:completed'
    | 'toast:show'
    | 'plugin:initialized'
    | 'news-feed:add';

export interface PluginEvent {
    type: PluginEventType;
    payload?: Record<string, unknown>;
    source?: string;
}

export type PluginEventHandler = (event: PluginEvent) => void;

// Plugin definition from config
export interface PluginDefinition {
    id: string;
    name: string;
    enabled: boolean;
    path: string;
    priority: number;
    config?: Record<string, unknown>;
}

// Runtime plugin instance
export interface Plugin {
    id: string;
    name: string;
    priority: number;
    config: Record<string, unknown>;
    Component: React.ComponentType<PluginComponentProps>;
    eventHandlers: Map<PluginEventType, PluginEventHandler>;
}

// Plugin component props
export interface PluginComponentProps {
    context: PluginContext;
    emit: (event: PluginEvent) => void;
    on: (eventType: PluginEventType, handler: PluginEventHandler) => () => void;
}

// Plugin hook return type
export interface PluginHookResult {
    plugins: Plugin[];
    isLoading: boolean;
    emit: (event: PluginEvent) => void;
}
