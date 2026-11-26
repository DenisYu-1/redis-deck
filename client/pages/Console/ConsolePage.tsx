import { useRef, useState, type KeyboardEvent } from 'react';
import { TierBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { runConsole, type ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';
import { ConsoleResults, type ResultsTab } from './ConsoleResults';
import { outputLines } from './output';
import { StatementChooser } from './StatementChooser';
import {
    allStatements,
    lineAtCursor,
    selectedStatements,
    type Statement
} from './statements';
import './console.css';

export function ConsolePage() {
    const { connections, currentEnvironment, addConsoleOutput } = useAppStore();
    const connection = connections.find((c) => c.id === currentEnvironment);
    const env = currentEnvironment ?? '';
    const editor = useRef<HTMLTextAreaElement>(null);
    const running = useRef(false);
    const [script, setScript] = useState('');
    const [run, setRun] = useState<{ env: string; results: ConsoleResult[] }>({
        env: '',
        results: []
    });
    const [tab, setTab] = useState<ResultsTab>('output');
    // opened for one script: any change to the script closes the popup
    const [chooser, setChooser] = useState<{
        script: string;
        line: number | undefined;
    } | null>(null);
    const choosing = chooser?.script === script;
    const all = allStatements(script);

    const execute = async (statements: Statement[]) => {
        if (!env || running.current) return;
        if (statements.length === 0) {
            showToast('Nothing to run there', 'info');
            return;
        }
        running.current = true;
        try {
            const results = await runConsole(env, statements);
            setRun({ env, results });
            setTab(0);
            addConsoleOutput(outputLines(env, results));
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Run failed',
                'error'
            );
        } finally {
            running.current = false;
        }
    };

    const runLine = () => {
        const el = editor.current;
        if (!el) return;
        void execute(
            selectedStatements(el.value, el.selectionStart, el.selectionEnd)
        );
    };

    const runAll = () => void execute(all);

    const toggleChooser = () => {
        const cursor = editor.current?.selectionStart ?? 0;
        setChooser(
            choosing ? null : { script, line: lineAtCursor(script, cursor) }
        );
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) runAll();
            else runLine();
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
                    onClick={runLine}
                >
                    Run line
                </Button>
                <Button
                    size="sm"
                    disabled={!env || all.length === 0}
                    aria-expanded={choosing}
                    onClick={toggleChooser}
                >
                    Choose statements…
                </Button>
                <Button size="sm" disabled={!env} onClick={runAll}>
                    Run all {all.length}
                </Button>
                <span className="xs mu chint">
                    ⌘/Ctrl+Enter run line or selection · ⌘/Ctrl+Shift+Enter run
                    all
                </span>
                {choosing && (
                    <StatementChooser
                        statements={all}
                        initialLine={chooser.line}
                        onRun={(picked) => {
                            setChooser(null);
                            void execute(picked);
                        }}
                        onClose={() => setChooser(null)}
                    />
                )}
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
                    onFocus={() => setChooser(null)}
                />
                <ConsoleResults
                    env={run.env}
                    results={run.env === env ? run.results : []}
                    tab={tab}
                    onTab={setTab}
                />
            </div>
        </div>
    );
}
