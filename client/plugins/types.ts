import type React from 'react';
import type { PluginContext } from '@/types';
import type { WorkflowAction } from '@/types/workflows';

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
    /** Optional: a plugin may only contribute Workflows (`actions`). */
    path?: string;
    priority: number;
    config?: Record<string, unknown>;
    /** Workflow manifest; handlers live on the server (see services/workflows). */
    actions?: WorkflowActionManifest[];
}

export type WorkflowActionManifest = Omit<WorkflowAction, 'fullId'>;

// Plugin component props
export interface PluginComponentProps {
    context: PluginContext;
    emit: (event: PluginEvent) => void;
    on: (eventType: PluginEventType, handler: PluginEventHandler) => () => void;
}

// Panel button metadata
export interface PluginPanelButton {
    readonly id: string;
    onClick: (params: {
        context: PluginContext;
        emit: (event: PluginEvent) => void;
        pluginId: string;
    }) => void;
}

// Runtime plugin instance
export interface Plugin {
    id: string;
    name: string;
    priority: number;
    config: Record<string, unknown>;
    Component: React.ComponentType<PluginComponentProps>;
    eventHandlers: Map<PluginEventType, PluginEventHandler>;
    readonly panelButton?: PluginPanelButton;
}

// Plugin hook return type
export interface PluginHookResult {
    plugins: Plugin[];
    isLoading: boolean;
    emit: (event: PluginEvent) => void;
}
