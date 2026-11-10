import type { ConnectionTier } from './index';

export interface WorkflowInput {
    name: string;
    label?: string;
    type: 'int' | 'uuid' | 'select';
    required?: boolean;
    placeholder?: string;
    hint?: string;
    options?: { value: string; label?: string }[];
    def?: string;
}

export interface WorkflowAction {
    id: string;
    fullId: string;
    title: string;
    desc?: string;
    writes: boolean;
    inputs: WorkflowInput[];
}

export interface WorkflowPlugin {
    id: string;
    name: string;
    actions: WorkflowAction[];
}

export interface WorkflowRun {
    id: number;
    connection: string;
    tier: ConnectionTier;
    inputs: Record<string, string | number>;
    ok: boolean;
    text: string;
    at: number;
}
