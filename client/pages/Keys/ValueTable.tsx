import { scoreDateHint, type ValueRow } from './valueRows';

interface Props {
    type: string;
    rows: ValueRow[];
    activeId: string | null;
    onPick: (id: string) => void;
}

const HEAD: Record<string, string[]> = {
    hash: ['Field', 'Value'],
    list: ['Index', 'Value'],
    set: ['Member'],
    zset: ['Member', 'Score']
};

function Cells({ type, row }: { type: string; row: ValueRow }) {
    if (type === 'set') return <td>{row.value}</td>;
    if (type === 'zset') {
        const hint = row.score ? scoreDateHint(row.score) : null;
        return (
            <>
                <td>{row.value}</td>
                <td>
                    {row.score}
                    {hint && <span className="hintx">{hint}</span>}
                </td>
            </>
        );
    }
    return (
        <>
            <td>{row.label}</td>
            <td className="val">{row.value}</td>
        </>
    );
}

export function ValueTable({ type, rows, activeId, onPick }: Props) {
    return (
        <table className="vtable">
            <thead>
                <tr>
                    {(HEAD[type] ?? []).map((h) => (
                        <th key={h}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                    <tr
                        key={r.id}
                        className={`pick ${activeId === r.id ? 'on' : ''}`}
                        tabIndex={0}
                        onClick={() => onPick(r.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onPick(r.id);
                        }}
                    >
                        <Cells type={type} row={r} />
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
