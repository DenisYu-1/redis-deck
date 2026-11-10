import { LockIcon } from '@/components/ui/Icons';
import { useAppStore } from '@/store/useAppStore';

/** Shown on production Connections: says how writes are guarded (enforced server-side). */
export function ProdBanner() {
    const { connections, currentEnvironment } = useAppStore();
    const conn = connections.find((c) => c.id === currentEnvironment);
    if (conn?.tier !== 'production') {
        return null;
    }
    return (
        <div className="banner" data-testid="prod-banner">
            <LockIcon />
            {conn.id} · production
            <span>
                {conn.readOnly
                    ? 'Read-only: writes, deletes and write workflows are blocked.'
                    : 'Writes ask you to type the connection name.'}
            </span>
        </div>
    );
}
