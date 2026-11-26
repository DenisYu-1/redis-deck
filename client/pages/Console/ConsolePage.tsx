import { useRef, useState, type KeyboardEvent } from 'react';
import { TierBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { runConsole, type ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';
import { ConsoleResults } from './ConsoleResults';
import { selectedStatements } from './statements';
import './console.css';

export function ConsolePage() {
    const { connections, currentEnvironment } = useAppStore();
    const connection = connections.find((c) => c.id === currentEnvironment);
    const env = currentEnvironment ?? '';
    const editor = useRef<HTMLTextAreaElement>(null);
    const running = useRef(false);
    const [script, setScript] = useState('');
    const [run, setRun] = useState<{ env: string; results: ConsoleResult[] }>({
        env: '',
        results: []
    });

    const runLine = async () => {
        const el = editor.current;
        if (!el || !env || running.current) return;
        const statements = selectedStatements(
            el.value,
            el.selectionStart,
            el.selectionEnd
        );
        if (statements.length === 0) {
            showToast('Nothing to run there', 'info');
            return;
        }
        running.current = true;
        try {
            setRun({ env, results: await runConsole(env, statements) });
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Run failed',
                'error'
            );
        } finally {
            running.current = false;
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            void runLine();
        }
    };

    return (
        <div className="console">
            <header className="chead">
                <h1 className="sr">Console</h1>
                {connection && (
                    <>
                        <TierBadge tier={connection.tier ?? 'local'} />
                        <span className="mono">
                            {connection.id} · db{connection.db ?? 0}
                        </span>
                    </>
                )}
            </header>
            <div className="ctool">
                <Button
                    variant="primary"
                    size="sm"
                    disabled={!env}
                    onClick={() => void runLine()}
                >
                    Run line
                </Button>
                <span className="xs mu chint">
                    ⌘/Ctrl+Enter runs the line or selection
                </span>
            </div>
            <div className="csplit">
                <textarea
                    ref={editor}
                    className="ced"
                    aria-label="Redis commands, one per line"
                    placeholder="PING"
                    spellCheck={false}
                    wrap="off"
                    autoCapitalize="off"
                    autoComplete="off"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <ConsoleResults results={run.env === env ? run.results : []} />
            </div>
        </div>
    );
}
