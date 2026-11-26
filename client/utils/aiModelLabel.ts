import type { AiModelSettings, AiProvider } from '@/services/apiService';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    'openai-compatible': 'OpenAI-compatible'
};

/** The assistant's mode and model, as the chat header and the card name them. */
export const modelLabel = (s: AiModelSettings): string => {
    if (!s.ready) return 'No model';
    if (s.mode === 'agent') {
        const agent = s.agents.find((a) => a.id === s.agent);
        return `${agent?.name ?? s.agent} · local agent`;
    }
    if (s.mode === 'local') return `Local model · ${s.localModel}`;
    return `${PROVIDER_LABELS[s.provider]} · ${s.model}`;
};
