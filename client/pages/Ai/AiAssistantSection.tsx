import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertIcon, CheckIcon, CloudIcon } from '@/components/ui/Icons';
import { useToast } from '@/hooks/useToast';
import {
    getAiModel,
    saveAiModel,
    testAiModel,
    type AiModelDraft,
    type AiModelSettings,
    type AiModelTestResult
} from '@/services/apiService';

const draftOf = ({ mode, provider, model }: AiModelSettings): AiModelDraft => ({
    mode,
    provider,
    model,
    apiKey: ''
});

/** "AI assistant": the model behind the built-in chat. */
export function AiAssistantSection() {
    const [saved, setSaved] = useState<AiModelSettings | null>(null);
    const [draft, setDraft] = useState<AiModelDraft | null>(null);
    const [result, setResult] = useState<AiModelTestResult | null>(null);
    const [busy, setBusy] = useState<'test' | 'save' | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getAiModel().then(
            (settings) => {
                if (cancelled) return;
                setSaved(settings);
                setDraft(draftOf(settings));
            },
            (e: Error) => showToast(`AI assistant: ${e.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const edit = (change: Partial<AiModelDraft>) => {
        setDraft((d) => d && { ...d, ...change });
        setResult(null);
    };

    const run = async (action: 'test' | 'save') => {
        if (!draft) return;
        setBusy(action);
        setResult(null);
        try {
            if (action === 'test') {
                setResult(await testAiModel(draft));
            } else {
                const settings = await saveAiModel(draft);
                setSaved(settings);
                setDraft(draftOf(settings));
                showToast('AI assistant settings saved', 'success');
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setBusy(null);
        }
    };

    const lastFour = saved?.keyLast4 ?? null;
    const hasKey = lastFour !== null;

    return (
        <section className="card sect" aria-label="AI assistant">
            <div className="sechead">
                <h2>AI assistant</h2>
                {saved && (
                    <span className={`pill aim-pill ${hasKey ? 'ok' : 'off'}`}>
                        {hasKey ? `Anthropic · ${saved.model}` : 'No key saved'}
                    </span>
                )}
            </div>
            {saved && draft && (
                <form
                    className="aim-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void run('save');
                    }}
                >
                    <div
                        className="modes"
                        role="radiogroup"
                        aria-label="Where the model runs"
                    >
                        <button
                            type="button"
                            className="mode"
                            role="radio"
                            aria-checked="true"
                        >
                            <b>
                                <CloudIcon />
                                API key
                            </b>
                            <span>
                                Call a model provider directly with your key
                            </span>
                        </button>
                    </div>
                    <div className="grid2">
                        <label className="field">
                            Provider
                            <select
                                className="select"
                                defaultValue={draft.provider}
                            >
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </label>
                        <label className="field">
                            Model
                            <select
                                className="select"
                                value={draft.model}
                                onChange={(e) =>
                                    edit({ model: e.target.value })
                                }
                            >
                                {saved.models.map((m) => (
                                    <option key={m}>{m}</option>
                                ))}
                            </select>
                        </label>
                        <div className="field span2">
                            <label htmlFor="aim-key">API key</label>
                            <input
                                id="aim-key"
                                className="input mono"
                                type="password"
                                autoComplete="off"
                                aria-describedby="aim-key-hint"
                                placeholder={
                                    hasKey
                                        ? `Saved: sk-ant-…${lastFour} — type to replace`
                                        : 'Paste your key'
                                }
                                value={draft.apiKey}
                                onChange={(e) =>
                                    edit({ apiKey: e.target.value })
                                }
                            />
                            <span id="aim-key-hint" className="hint">
                                Stored on the Redis Deck server. The browser
                                only ever sees the last four characters.
                            </span>
                        </div>
                    </div>
                    {result && (
                        <div
                            className={`callout ${result.ok ? 'ok' : 'err'}`}
                            role="status"
                        >
                            {result.ok ? <CheckIcon /> : <AlertIcon />}
                            <div>
                                <b>{result.title}</b>
                                <span className="sm tx2">{result.detail}</span>
                            </div>
                        </div>
                    )}
                    <div className="aim-actions">
                        <Button
                            disabled={busy !== null}
                            onClick={() => void run('test')}
                        >
                            {busy === 'test' && (
                                <span className="spin" aria-hidden="true" />
                            )}
                            Test
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={busy !== null}
                        >
                            Save
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}
