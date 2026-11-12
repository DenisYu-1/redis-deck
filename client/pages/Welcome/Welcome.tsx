import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
    addConnection,
    loadEnvironments,
    testConnectionDraft
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';
import {
    applyParsedUri,
    blankDraft,
    draftToPayload,
    type ConnectionDraft
} from '../Connections/connectionDraft';
import { parseRedisUri } from '../Connections/uriParser';
import './welcome.css';

interface TestResult {
    success: boolean;
    message: string;
}

/** First-run screen: shown on every route while there are no Connections. */
export function Welcome() {
    const navigate = useNavigate();
    const setConnections = useAppStore((s) => s.setConnections);
    const setCurrentEnvironment = useAppStore((s) => s.setCurrentEnvironment);
    const [draft, setDraft] = useState<ConnectionDraft>(blankDraft);
    const [uri, setUri] = useState('');
    const [errors, setErrors] = useState<{ id?: string; host?: string }>({});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const change = (next: ConnectionDraft) => {
        setDraft(next);
        setTestResult(null);
    };

    const handleUri = (value: string) => {
        setUri(value);
        const parsed = parseRedisUri(value);
        if (parsed) change(applyParsedUri(draft, parsed));
    };
    const uriInvalid = uri.trim() !== '' && !parseRedisUri(uri);

    const handleTest = async () => {
        if (!draft.host.trim()) {
            setErrors({ host: 'Enter a host' });
            return;
        }
        setTesting(true);
        const result = await testConnectionDraft({
            ...draftToPayload(draft),
            id: ''
        });
        setTestResult(result);
        showToast(result.message, result.success ? 'success' : 'error');
        setTesting(false);
    };

    const handleSave = async () => {
        const next: { id?: string; host?: string } = {};
        if (!draft.id.trim()) next.id = 'Give the connection a name';
        if (!draft.host.trim()) next.host = 'Enter a host';
        setErrors(next);
        if (Object.keys(next).length) return;
        try {
            const payload = draftToPayload(draft);
            await addConnection(payload);
            setConnections(await loadEnvironments());
            setCurrentEnvironment(payload.id);
            void navigate('/keys');
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : 'Error saving connection',
                'error'
            );
        }
    };

    return (
        <div className="welcome">
            <div className="wtop">
                <Logo />
                <span className="grow" />
                <ThemeToggle />
            </div>
            <div className="wcenter">
                <div className="wcol">
                    <div className="wintro">
                        <h1>Connect to a Redis server</h1>
                        <p>
                            Paste a connection URI, or fill in the details. You
                            can add more servers later on the Connections page.
                        </p>
                    </div>
                    <form
                        className="card wcard"
                        aria-label="New connection"
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleSave();
                        }}
                    >
                        <label className="field">
                            Connection URI
                            <input
                                className="input mono"
                                type="text"
                                value={uri}
                                placeholder="redis://user:password@host:6379/0"
                                autoComplete="off"
                                onChange={(e) => handleUri(e.target.value)}
                            />
                            {uriInvalid ? (
                                <span className="err">
                                    Not a valid redis:// or rediss:// URI
                                </span>
                            ) : (
                                <span className="hint">
                                    Use rediss:// for TLS.
                                </span>
                            )}
                        </label>
                        <div className="grid6">
                            <div className="field s3">
                                <label htmlFor="wl-name">Name</label>
                                <input
                                    id="wl-name"
                                    className={`input ${errors.id ? 'bad' : ''}`}
                                    type="text"
                                    value={draft.id}
                                    aria-invalid={Boolean(errors.id)}
                                    onChange={(e) =>
                                        change({ ...draft, id: e.target.value })
                                    }
                                />
                                {errors.id && (
                                    <span className="err">{errors.id}</span>
                                )}
                            </div>
                            <div className="field s2">
                                <label htmlFor="wl-host">Host</label>
                                <input
                                    id="wl-host"
                                    className={`input mono ${errors.host ? 'bad' : ''}`}
                                    type="text"
                                    value={draft.host}
                                    aria-invalid={Boolean(errors.host)}
                                    onChange={(e) =>
                                        change({
                                            ...draft,
                                            host: e.target.value
                                        })
                                    }
                                />
                                {errors.host && (
                                    <span className="err">{errors.host}</span>
                                )}
                            </div>
                            <div className="field s1">
                                <label htmlFor="wl-port">Port</label>
                                <input
                                    id="wl-port"
                                    className="input mono"
                                    type="text"
                                    inputMode="numeric"
                                    value={draft.port}
                                    onChange={(e) =>
                                        change({
                                            ...draft,
                                            port: e.target.value
                                        })
                                    }
                                />
                            </div>
                        </div>
                        {testResult && (
                            <div
                                className={`callout ${testResult.success ? 'ok' : 'err'}`}
                                role="status"
                            >
                                {testResult.message}
                            </div>
                        )}
                        <div className="wactions">
                            <Button
                                onClick={() => void handleTest()}
                                disabled={testing}
                            >
                                {testing && <span className="spin" />}Test
                            </Button>
                            <span className="grow" />
                            <Button variant="primary" type="submit">
                                Save and open
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
