import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Statement } from './statements';

interface Props {
    statements: Statement[];
    /** Line of the statement checked when the popup opens */
    initialLine: number | undefined;
    onRun: (statements: Statement[]) => void;
    onClose: () => void;
}

/** The "Choose statements…" checklist popup. */
export function StatementChooser({
    statements,
    initialLine,
    onRun,
    onClose
}: Props) {
    const [picked, setPicked] = useState(
        () => new Set(initialLine === undefined ? [] : [initialLine])
    );

    const toggle = (line: number) => {
        const next = new Set(picked);
        if (!next.delete(line)) next.add(line);
        setPicked(next);
    };

    return (
        <div
            className="cpop"
            role="dialog"
            aria-label="Choose statements to run"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
            <div className="cpophead">
                <b>Run which statements?</b>
                <Button
                    size="xs"
                    autoFocus
                    onClick={() =>
                        setPicked(new Set(statements.map((s) => s.line)))
                    }
                >
                    All
                </Button>
                <Button size="xs" onClick={() => setPicked(new Set())}>
                    None
                </Button>
            </div>
            {statements.map((s) => (
                <label key={s.line}>
                    <input
                        type="checkbox"
                        checked={picked.has(s.line)}
                        onChange={() => toggle(s.line)}
                    />
                    <span className="cpopline mu">{s.line}</span>
                    <span className="ellip">{s.text}</span>
                </label>
            ))}
            <div className="cpopfoot">
                <Button size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    disabled={picked.size === 0}
                    onClick={() =>
                        onRun(statements.filter((s) => picked.has(s.line)))
                    }
                >
                    Run {picked.size} selected
                </Button>
            </div>
        </div>
    );
}
