import type { ReactNode } from 'react';
import type { ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { ConsoleOutput } from './ConsoleOutput';
import { ConsoleReply } from './ConsoleReply';

/** The Output history, or the index of a statement of the last run. */
export type ResultsTab = 'output' | number;

interface Props {
    env: string;
    results: ConsoleResult[];
    tab: ResultsTab;
    onTab: (tab: ResultsTab) => void;
}

const commandOf = (text: string) => text.split(/\s+/, 1).join('').toUpperCase();

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

export function ConsoleResults({ env, results, tab, onTab }: Props) {
    const count = useAppStore((s) => s.consoleOutput.length);
    // no result: the Output tab, also once the results are gone
    const result = tab === 'output' ? undefined : results[tab];
    return (
        <section className="results" aria-label="Results">
            <div className="rtabs" role="tablist">
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
                {result ? (
                    <>
                        <div className="rhead mono xs">
                            <span className="ellip">{result.text}</span>
                            <span className="mu">
                                line {result.line} · {env} · {result.ms} ms
                            </span>
                        </div>
                        <ConsoleReply result={result} />
                    </>
                ) : (
                    <ConsoleOutput />
                )}
            </div>
        </section>
    );
}
