export interface Outcome {
    kind: 'plan' | 'result' | 'error';
    ok: boolean;
    text: string;
}

const TITLE = { plan: 'Dry run', result: 'Result', error: 'Error' } as const;

export function PlanPanel({ outcome }: { outcome: Outcome | null }) {
    if (!outcome) {
        return null;
    }
    return (
        <section
            className="card wf-panel"
            aria-label={TITLE[outcome.kind]}
            data-testid="plan-panel"
        >
            <div className="navhead">
                <span>{TITLE[outcome.kind]}</span>
            </div>
            <pre className={`mono sm ${outcome.ok ? '' : 'err'}`}>
                {outcome.text}
            </pre>
        </section>
    );
}
