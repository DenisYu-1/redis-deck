import { useEffect } from 'react';
import { TierBadge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import {
    listAiAccess,
    setAiAccess,
    type AiAccessField,
    type AiAccessRow
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

const COLUMNS: { field: AiAccessField; label: string }[] = [
    { field: 'keys', label: 'See keys' },
    { field: 'values', label: 'See values' },
    { field: 'write', label: 'Write' },
    { field: 'workflows', label: 'Workflows' },
    { field: 'ask', label: 'Ask before writes' }
];

/** Why a box cannot be changed (the server refuses or ignores it), if so. */
function lockReason(row: AiAccessRow, field: AiAccessField): string | null {
    if (field === 'keys') return null;
    if (field === 'ask') {
        if (row.tier === 'production') return 'Always on for production';
        if (!row.write && !row.workflows)
            return 'Allow writes or workflows first';
        return null;
    }
    if (!row.keys) return 'Allow keys first';
    if (row.readOnly && field !== 'values')
        return 'The connection itself is read-only';
    return null;
}

/** AI access grid: per Connection, what AI clients may see and do. */
export function AiAccessGrid() {
    const rows = useAppStore((s) => s.aiAccess);
    const setRows = useAppStore((s) => s.setAiAccessRows);
    const { showToast } = useToast();

    useEffect(() => {
        let cancelled = false;
        listAiAccess().then(
            (list) => {
                if (!cancelled) setRows(list);
            },
            (e: Error) => showToast(`AI access: ${e.message}`, 'error')
        );
        return () => {
            cancelled = true;
        };
    }, [setRows, showToast]);

    const toggle = async (row: AiAccessRow, field: AiAccessField) => {
        try {
            const saved = await setAiAccess(row.id, { [field]: !row[field] });
            const all = useAppStore.getState().aiAccess;
            setRows(all.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
        } catch (error) {
            showToast((error as Error).message, 'error');
        }
    };

    return (
        <section className="card sect" aria-label="AI access">
            <h2>What AI may do</h2>
            <p className="sm tx2">
                Set per Connection. Values, write and Workflows need See keys.
            </p>
            <div className="ctable-wrap">
                <table className="ctable">
                    <thead>
                        <tr>
                            <th>Connection</th>
                            {COLUMNS.map((c) => (
                                <th key={c.field}>{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} data-testid="ai-access-row">
                                <td>
                                    {row.id} <TierBadge tier={row.tier} />
                                </td>
                                {COLUMNS.map(({ field, label }) => {
                                    const reason = lockReason(row, field);
                                    return (
                                        <td key={field}>
                                            <input
                                                type="checkbox"
                                                aria-label={`${label} for ${row.id}`}
                                                title={reason ?? undefined}
                                                checked={row[field]}
                                                disabled={reason !== null}
                                                onChange={() =>
                                                    void toggle(row, field)
                                                }
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
