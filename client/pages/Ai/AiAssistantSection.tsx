import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
    AlertIcon,
    CheckIcon,
    CloudIcon,
    CpuIcon,
    ServerIcon
} from '@/components/ui/Icons';
import { useToast } from '@/hooks/useToast';
import {
    getAiModel,
    saveAiModel,
    testAiModel,
    type AiModelDraft,
    type AiModelSettings,
    type AiModelTestResult
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { agentFields } from '@/utils/aiAgentFields';
import { modelLabel } from '@/utils/aiModelLabel';
import { AiAgentFields } from './AiAgentFields';
import { AiApiKeyFields } from './AiApiKeyFields';
import { AiLocalModelFields } from './AiLocalModelFields';
import { useLocalModels } from './useLocalModels';

const draftOf = (s: AiModelSettings): AiModelDraft => ({
    mode: s.mode,
    provider: s.provider,
    model: s.model,
    baseUrl: s.baseUrl,
    localUrl: s.localUrl,
    localModel: s.localModel,
    ...agentFields(s, s.agent),
    apiKey: ''
});

/** The header pill: the model in use, or what its mode is missing. */
const pillText = (s: AiModelSettings): string => {
    if (!s.ready && s.mode === 'api') return 'No key saved';
    const agent = s.agents.find((a) => a.id === s.agent);
    if (!s.ready && s.mode === 'agent') return `${agent?.command} not found`;
    return modelLabel(s);
};

const MODES = [
    {
        mode: 'agent',
        title: 'Local agent',
        description:
            'A CLI agent on the Redis Deck host, wired to its MCP server',
        Icon: CpuIcon
    },
    {
        mode: 'api',
        title: 'API key',
        description: 'Call a model provider directly with your key',
        Icon: CloudIcon
    },
    {
        mode: 'local',
        title: 'Local model',
        description:
            'Ollama or a compatible server; nothing leaves your network',
        Icon: ServerIcon
    }
] as const;

/** "AI assistant": the model behind the built-in chat. */
export function AiAssistantSection() {
    // Shared with the chat panel, which names the model in its header.
    const saved = useAppStore((s) => s.aiModel);
    const setSaved = useAppStore((s) => s.setAiModel);
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
    }, [showToast, setSaved]);

    // A model the server does not list cannot stay selected.
    const pickLocalModel = useCallback(
        (models: string[]) =>
            setDraft(
                (d) =>
                    d && {
                        ...d,
                        localModel: models.includes(d.localModel)
                            ? d.localModel
                            : (models[0] ?? '')
                    }
            ),
        []
    );
    const local = useLocalModels(pickLocalModel);

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
                const tested = await testAiModel(draft);
                setResult(tested);
                if (tested.models) local.offer(tested.models);
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

    return (
        <section className="card sect" aria-label="AI assistant">
            <div className="sechead">
                <h2>AI assistant</h2>
                {saved && (
                    <span
                        className={`pill aim-pill ${saved.ready ? 'ok' : 'off'}`}
                    >
                        {pillText(saved)}
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
                        {MODES.map(({ mode, title, description, Icon }) => (
                            <button
                                key={mode}
                                type="button"
                                className="mode"
                                role="radio"
                                aria-checked={draft.mode === mode}
                                onClick={() => edit({ mode, apiKey: '' })}
                            >
                                <b>
                                    <Icon />
                                    {title}
                                </b>
                                <span>{description}</span>
                            </button>
                        ))}
                    </div>
                    {draft.mode === 'agent' && (
                        <AiAgentFields
                            saved={saved}
                            draft={draft}
                            onChange={edit}
                        />
                    )}
                    {draft.mode === 'api' && (
                        <AiApiKeyFields
                            saved={saved}
                            draft={draft}
                            onChange={edit}
                        />
                    )}
                    {draft.mode === 'local' && (
                        <AiLocalModelFields
                            draft={draft}
                            onChange={edit}
                            local={local}
                        />
                    )}
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
