import { useEffect, useRef } from 'react';
import { InfoIcon } from '@/components/ui/Icons';
import type { AiModelDraft } from '@/services/apiService';
import type { LocalModels } from './useLocalModels';

interface Props {
    draft: AiModelDraft;
    onChange: (change: Partial<AiModelDraft>) => void;
    local: LocalModels;
}

/** "Local model" mode: the server URL and one of the models it lists. */
export function AiLocalModelFields({ draft, onChange, local }: Props) {
    const { models, error, load } = local;
    // The select keeps showing the saved model while the server is away.
    const options =
        draft.localModel && !models.includes(draft.localModel)
            ? [draft.localModel, ...models]
            : models;

    // On entering the mode; later URL edits load when the field is left.
    const enteredWith = useRef(draft.localUrl);
    useEffect(() => load(enteredWith.current), [load]);

    return (
        <>
            <div className="grid2">
                <div className="field span2">
                    <label htmlFor="aim-url">Server URL</label>
                    <input
                        id="aim-url"
                        className="input mono"
                        placeholder="http://localhost:11434"
                        aria-describedby="aim-url-hint"
                        value={draft.localUrl}
                        onChange={(e) => onChange({ localUrl: e.target.value })}
                        onBlur={() => load(draft.localUrl)}
                    />
                    <span id="aim-url-hint" className="hint">
                        Ollama, or any OpenAI-compatible server on your network.
                        A URL without a path gets /v1.
                    </span>
                </div>
                <div className="field span2">
                    <label htmlFor="aim-local-model">Model</label>
                    <select
                        id="aim-local-model"
                        className="select"
                        aria-describedby="aim-local-hint"
                        value={draft.localModel}
                        onChange={(e) =>
                            onChange({ localModel: e.target.value })
                        }
                    >
                        {options.map((m) => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                    <span id="aim-local-hint" className="hint">
                        {error && `Could not list the models: ${error}`}
                    </span>
                </div>
            </div>
            <p className="aim-note">
                <InfoIcon />
                <span>
                    Small local models follow multi-step tool use less reliably.
                    The assistant still asks before every write.
                </span>
            </p>
        </>
    );
}
