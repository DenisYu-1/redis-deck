import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import {
    getAiClientSnippet,
    installAiClient,
    listAiActivityClients,
    listAiClients,
    removeAiClient,
    type AiActivityClient,
    type AiClient,
    type AiClientSnippet,
    type AiClientStatus
} from '@/services/apiService';
import { AiToolsSection } from './AiToolsSection';

const STATUS_LABEL: Record<AiClientStatus, string> = {
    'not-found': 'Not found',
    'not-installed': 'Not added',
    installed: 'Added',
    stale: 'Outdated',
    error: 'Error'
};

const RECENT_MS = 60 * 60 * 1000;

function ago(ms: number): string {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

interface Snippet extends AiClientSnippet {
    name: string;
}

/**
 * AI clients: MCP server card, Tools exposed and the install rows. Render only
 * in the Desktop app.
 */
export function AiClientsSection() {
    const [clients, setClients] = useState<AiClient[]>([]);
    const [command, setCommand] = useState('');
    const [active, setActive] = useState<AiActivityClient[]>([]);
    const [now, setNow] = useState(0);
    const [busy, setBusy] = useState<string | null>(null);
    const [restartHint, setRestartHint] = useState<string | null>(null);
    const [snippet, setSnippet] = useState<Snippet | null>(null);
    const [showSupported, setShowSupported] = useState(false);
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

    useEffect(() => {
        let cancelled = false;
        const load = () =>
            listAiActivityClients({ aiClientsOnly: true }).then(
                (list) => {
                    if (cancelled) return;
                    setActive(list);
                    setNow(Date.now());
                },
                () => undefined
            );
        void load();
        const timer = setInterval(load, 5000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

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

    const found = clients.filter((c) => c.status !== 'not-found');
    const absent = clients.filter((c) => c.status === 'not-found');

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
                <h3>Connected clients</h3>
                {active.length === 0 ? (
                    <p className="sm mu">No AI clients yet.</p>
                ) : (
                    <ul className="aic-connected">
                        {active.map((a) => {
                            const age = now - a.lastCallAt;
                            return (
                                <li key={a.client}>
                                    <span
                                        className={`aic-dot${age < RECENT_MS ? ' on' : ''}`}
                                    />
                                    <span>{a.client}</span>
                                    <span className="sm mu">
                                        last call {ago(age)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
            <AiToolsSection />
            <section className="card sect" aria-label="Add to a client">
                <h2>Add to a client</h2>
                <div className="ctable-wrap">
                    <table className="ctable aic-table">
                        <tbody>
                            {found.map((c) => (
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
                                                Add
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
                                                    Re-add
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
                {clients.length > 0 && found.length === 0 && (
                    <p className="sm mu">
                        No supported AI clients found on this computer.
                    </p>
                )}
                {absent.length > 0 && (
                    <Button size="sm" onClick={() => setShowSupported(true)}>
                        {absent.length} more supported
                    </Button>
                )}
                {showSupported && (
                    <Modal
                        title="Supported AI clients"
                        onClose={() => setShowSupported(false)}
                        footer={
                            <Button onClick={() => setShowSupported(false)}>
                                Close
                            </Button>
                        }
                    >
                        <p className="sm tx2">Not found on this computer.</p>
                        <table className="ctable aic-table">
                            <tbody>
                                {absent.map((c) => (
                                    <tr key={c.id}>
                                        <td className="aic-name">{c.name}</td>
                                        <td className="aic-actions">
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setShowSupported(false);
                                                    void openSnippet(c);
                                                }}
                                            >
                                                Manual setup
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Modal>
                )}
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
