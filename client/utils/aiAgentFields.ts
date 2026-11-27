import type { AiModelSettings } from '@/services/apiService';

/** The draft fields of one agent, as saved. */
export const agentFields = (s: AiModelSettings, id: string) => {
    const agent = s.agents.find((a) => a.id === id);
    return {
        agent: id,
        agentPath: agent?.path ?? '',
        agentArgs: agent?.args ?? ''
    };
};
