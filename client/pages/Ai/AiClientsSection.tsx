import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import {
    getAiClientSnippet,
    installAiClient,
    listAiClients,
    removeAiClient,
    type AiClient,
    type AiClientSnippet,
    type AiClientStatus
} from '@/services/apiService';

const STATUS_LABEL: Record<AiClientStatus, string> = {
    'not-installed': 'Not installed',
    installed: 'Installed',
    stale: 'Stale',
    error: 'Error'
};

interface Snippet extends AiClientSnippet {
    name: string;
}

/** MCP server card and AI client install rows. Render only in the Desktop app. */
export function AiClientsSection() {
    const [clients, setClients] = useState<AiClient[]>([]);
    const [command, setCommand] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [restartHint, setRestartHint] = useState<string | null>(null);
    const [snippet, setSnippet] = useState<Snippet | null>(null);
    const { showToast } = useToast();

    const refresh = useCallback(async () => {
        try {
            const list = await listAiClients();
            setClients(list.clients);
            setCommand(list.command);
        } catch (error) {
            showToast(`AI clients: ${(error as Error).message}`, 'error');
        }
    }, [showToast]);

    useEffect(() => {
        let cancelled = false;
        listAiClients().then(
            (list) => {
                if (cancelled) return;
                setClients(list.clients);
                setCommand(list.command);
            },
            (error: Error) => showToast(`AI clients: ${error.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const act = async (c: AiClient, action: 'install' | 'remove') => {
        setBusy(c.id);
        try {
            if (action === 'install') {
                await installAiClient(c.id);
                setRestartHint(c.name);
            } else {
                await removeAiClient(c.id);
                setRestartHint(null);
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setBusy(null);
            await refresh();
        }
    };

    const openSnippet = async (c: AiClient) => {
        try {
            setSnippet({ name: c.name, ...(await getAiClientSnippet(c.id)) });
        } catch (error) {
            showToast((error as Error).message, 'error');
        }
    };

    const copy = (text: string) => {
        navigator.clipboard.writeText(text).then(
            () => showToast('Copied', 'success'),
            () => showToast('Copy failed', 'error')
        );
    };

    return (
        <>
            <section className="card sect" aria-label="MCP server">
                <h2>MCP server</h2>
                <p className="sm tx2">
                    Stdio command AI clients run to reach Redis Deck.
                </p>
                <div className="aic-cmd">
                    <code className="mono">{command}</code>
                    <Button size="sm" onClick={() => copy(command)}>
                        Copy
                    </Button>
                </div>
            </section>
            <section className="card sect" aria-label="Add to a client">
                <h2>Add to a client</h2>
                <div className="ctable-wrap">
                    <table className="ctable">
                        <tbody>
                            {clients.map((c) => (
                                <tr key={c.id} data-testid="ai-client-row">
                                    <td className="aic-name">{c.name}</td>
                                    <td>
                                        <span
                                            className={`aic-status ${c.status}`}
                                            title={c.error ?? c.configPath}
                                        >
                                            {STATUS_LABEL[c.status]}
                                        </span>
                                    </td>
                                    <td className="aic-actions">
                                        {c.status === 'not-installed' && (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                disabled={busy === c.id}
                                                onClick={() =>
                                                    void act(c, 'install')
                                                }
                                            >
                                                Install
                                            </Button>
                                        )}
                                        {(c.status === 'installed' ||
                                            c.status === 'stale') && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        c.status === 'stale'
                                                            ? 'primary'
                                                            : 'default'
                                                    }
                                                    disabled={busy === c.id}
                                                    onClick={() =>
                                                        void act(c, 'install')
                                                    }
                                                >
                                                    Reinstall
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    disabled={busy === c.id}
                                                    onClick={() =>
                                                        void act(c, 'remove')
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => void openSnippet(c)}
                                        >
                                            Manual setup
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {restartHint && (
                    <p className="sm tx2" role="status">
                        Restart {restartHint} to load Redis Deck.
                    </p>
                )}
                {snippet && (
                    <Modal
                        title={`Manual setup: ${snippet.name}`}
                        onClose={() => setSnippet(null)}
                        footer={
                            <>
                                <Button onClick={() => setSnippet(null)}>
                                    Close
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => copy(snippet.text)}
                                >
                                    Copy
                                </Button>
                            </>
                        }
                    >
                        <p className="sm tx2">
                            Add this to{' '}
                            <span className="mono">{snippet.path}</span>, then
                            restart {snippet.name}.
                        </p>
                        <pre className="aic-snippet mono">{snippet.text}</pre>
                    </Modal>
                )}
            </section>
        </>
    );
}
