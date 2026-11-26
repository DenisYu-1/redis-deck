import type { AiAccessRow } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

function noteFor({ write, workflows, ask }: AiAccessRow): string {
    if (!write && !workflows) return 'Writes are off on this Connection';
    return ask
        ? 'Writes wait for your approval'
        : 'Writes run without asking on this Connection';
}

/** The footer's word on what a write of the assistant does here. */
export function WritesNote() {
    const row = useAppStore((s) =>
        s.aiAccess.find((r) => r.id === s.currentEnvironment)
    );
    return row ? <span className="xs mu">{noteFor(row)}</span> : null;
}
