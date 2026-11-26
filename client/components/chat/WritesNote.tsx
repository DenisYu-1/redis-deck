import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { listAiAccess, type AiAccessRow } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

function noteFor({ write, workflows, ask }: AiAccessRow): string {
    if (!write && !workflows) return 'Writes are off on this connection';
    return ask
        ? 'Writes wait for your approval'
        : 'Writes run without asking on this connection';
}

/** The footer's word on what a write of the assistant does here. */
export function WritesNote() {
    const connection = useAppStore((s) => s.currentEnvironment);
    // AI access can change on another page; read it again after one, and
    // after a turn.
    const busy = useAppStore((s) => s.chat.busy);
    const { pathname } = useLocation();
    const [row, setRow] = useState<AiAccessRow>();

    useEffect(() => {
        let stale = false;
        listAiAccess().then(
            (rows) => {
                if (!stale) setRow(rows.find((r) => r.id === connection));
            },
            (error: unknown) =>
                console.error('Failed to load AI access:', error)
        );
        return () => {
            stale = true;
        };
    }, [connection, pathname, busy]);

    if (!row || row.id !== connection) return null;
    return <span className="xs mu">{noteFor(row)}</span>;
}
