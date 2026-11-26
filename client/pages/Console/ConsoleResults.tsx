import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ChatIcon } from '@/components/ui/Icons';
import type { ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { ConsoleOutput } from './ConsoleOutput';
import { ConsoleReply } from './ConsoleReply';
import { commandWords } from './lineCheck';
import type { Statement } from './statements';

/** The Output history, or the index of a statement of the last run. */
export type ResultsTab = 'output' | number;

interface Props {
    env: string;
    results: ConsoleResult[];
    tab: ResultsTab;
    onTab: (tab: ResultsTab) => void;
    /** Runs a statement whose result takes the place of result `index`. */
    onRerun: (index: number, statement: Statement) => void;
    onAsk: (result: ConsoleResult) => void;
}

const commandOf = (text: string) => commandWords(text)[0]?.toUpperCase();

const dotColor = (kind: ConsoleResult['kind']) => {
    if (kind === 'error') return 'var(--ac)';
    return kind === 'not-run' ? 'var(--mu)' : 'var(--ok)';
};

function Tab({
    selected,
    onClick,
    children
}: {
    selected: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className="rtab"
            role="tab"
            aria-selected={selected}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function ConsoleResults({
    env,
    results,
    tab,
    onTab,
    onRerun,
    onAsk
}: Props) {
    const count = useAppStore((s) => s.consoleOutput.length);
    // no result: the Output tab, also once the results are gone
    const result = tab === 'output' ? undefined : results[tab];
    return (
        <section className="results" aria-label="Results">
            <div className="rtabs" role="tablist" aria-label="Statements run">
                <Tab selected={!result} onClick={() => onTab('output')}>
                    Output <span className="mono xs mu">{count}</span>
                </Tab>
                {results.map((r, i) => (
                    <Tab
                        key={i}
                        selected={r === result}
                        onClick={() => onTab(i)}
                    >
                        <span
                            className="rdot"
                            style={{ background: dotColor(r.kind) }}
                        />
                        <span className="mono">
                            {i + 1}: {commandOf(r.text)}
                        </span>
                    </Tab>
                ))}
            </div>
            <div className="rbody" role="tabpanel">
                {result && typeof tab === 'number' ? (
                    <>
                        <div className="rhead mono xs">
                            <span className="ellip rcmd">{result.text}</span>
                            <span className="mu">
                                line {result.line} · {env}
                                {result.node && ` · node ${result.node}`} ·{' '}
                                {result.ms} ms
                            </span>
                            <Button size="xs" onClick={() => onAsk(result)}>
                                <ChatIcon />
                                Ask about result
                            </Button>
                        </div>
                        <ConsoleReply
                            key={`${tab} ${result.text}`}
                            result={result}
                            onRerun={(text) =>
                                onRerun(tab, { line: result.line, text })
                            }
                        />
                    </>
                ) : (
                    <ConsoleOutput />
                )}
            </div>
        </section>
    );
}
