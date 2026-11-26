import type { AiModelSettings } from '@/services/apiService';

/** The assistant's model as the chat header and the Model card name it. */
export const modelLabel = ({ keyLast4, model }: AiModelSettings): string =>
    keyLast4 === null ? 'No model' : `Anthropic · ${model}`;
