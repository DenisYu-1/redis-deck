import type {
    AiModelDraft,
    AiModelSettings,
    AiProvider
} from '@/services/apiService';
import { PROVIDER_LABELS } from '@/utils/aiModelLabel';

const KEY_PREFIXES: Record<AiProvider, string> = {
    anthropic: 'sk-ant-…',
    openai: 'sk-…',
    'openai-compatible': '…'
};

const withoutSlash = (url: string) => url.trim().replace(/\/+$/, '');

interface Props {
    saved: AiModelSettings;
    draft: AiModelDraft;
    onChange: (change: Partial<AiModelDraft>) => void;
}

/** "API key" mode: provider, model, Base URL and the key. */
export function AiApiKeyFields({ saved, draft, onChange }: Props) {
    const { provider } = draft;
    const compatible = provider === 'openai-compatible';
    const lastFour = saved.keyLast4;
    // The server sends a saved key only where it was entered for.
    const keyApplies =
        lastFour !== null &&
        provider === saved.provider &&
        withoutSlash(draft.baseUrl) === saved.baseUrl;

    // A typed key never follows to another provider or Base URL.
    const pickProvider = (next: AiProvider) => {
        const stored = next === saved.provider;
        const fallback = next === 'anthropic' ? saved.defaultModel : '';
        onChange({
            provider: next,
            model: stored ? saved.model : fallback,
            baseUrl: stored ? saved.baseUrl : '',
            apiKey: ''
        });
    };

    return (
        <div className="grid2">
            <label className="field">
                Provider
                <select
                    className="select"
                    value={provider}
                    onChange={(e) => pickProvider(e.target.value as AiProvider)}
                >
                    {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="field">
                Model
                {provider === 'anthropic' ? (
                    <select
                        className="select"
                        value={draft.model}
                        onChange={(e) => onChange({ model: e.target.value })}
                    >
                        {saved.models.map((m) => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        className="input mono"
                        placeholder="model id"
                        value={draft.model}
                        onChange={(e) => onChange({ model: e.target.value })}
                    />
                )}
            </label>
            {compatible && (
                <label className="field span2">
                    Base URL
                    <input
                        className="input mono"
                        placeholder="https://api.example.com/v1"
                        value={draft.baseUrl}
                        onChange={(e) =>
                            onChange({ baseUrl: e.target.value, apiKey: '' })
                        }
                    />
                </label>
            )}
            <div className="field span2">
                <label htmlFor="aim-key">API key</label>
                <input
                    id="aim-key"
                    className="input mono"
                    type="password"
                    autoComplete="off"
                    aria-describedby="aim-key-hint"
                    placeholder={
                        keyApplies
                            ? `Saved: ${KEY_PREFIXES[provider]}${lastFour} — type to replace`
                            : 'Paste your key'
                    }
                    value={draft.apiKey}
                    onChange={(e) => onChange({ apiKey: e.target.value })}
                />
                <span id="aim-key-hint" className="hint">
                    Stored on the Redis Deck server. The browser only ever sees
                    the last four characters.
                    {lastFour !== null &&
                        !keyApplies &&
                        ' Saving removes the key saved for the other provider or Base URL.'}
                </span>
            </div>
        </div>
    );
}
