import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { deleteKeys, exportKeys, setKeysTtl } from '@/services/apiService';
import { showToast } from '@/utils/toast';
import { BulkTtlDialog } from './BulkTtlDialog';
import { SelectionBar } from './SelectionBar';

export const EXPORT_CAP = 1000;

type Dialog = 'ttl' | 'delete' | null;

interface BulkActionsProps {
    env: string;
    readOnly: boolean;
    keys: string[];
    matched: number;
    onClear: () => void;
    /** Called after a write so the list can refresh. */
    onChanged: () => void;
}

function download(name: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function BulkActions({
    env,
    readOnly,
    keys,
    matched,
    onClear,
    onChanged
}: BulkActionsProps) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);

    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), 'error');
        } finally {
            setBusy(false);
            setDialog(null);
        }
    };

    const applyTtl = (seconds: number | null) =>
        run(async () => {
            const { updated } = await setKeysTtl(keys, seconds, env);
            showToast(
                `${seconds === null ? 'Removed expiry on' : 'Set TTL on'} ${String(updated)} keys`
            );
            onChanged();
        });

    const confirmDelete = () =>
        run(async () => {
            const { deleted } = await deleteKeys(keys, env);
            showToast(`Deleted ${String(deleted)} keys`);
            onClear();
            onChanged();
        });

    const doExport = () => {
        if (keys.length > EXPORT_CAP) {
            showToast(
                `Export is limited to ${String(EXPORT_CAP)} keys; ${String(keys.length)} selected`,
                'error'
            );
            return;
        }
        void run(async () => {
            const entries = await exportKeys(keys, env);
            download(`redis-keys-${env}.json`, entries);
            showToast(`Exported ${String(entries.length)} keys`);
        });
    };

    return (
        <>
            <SelectionBar
                count={keys.length}
                matched={matched}
                readOnly={readOnly}
                onClear={onClear}
                onTtl={() => setDialog('ttl')}
                onExport={doExport}
                onDelete={() => setDialog('delete')}
            />
            {dialog === 'ttl' && (
                <BulkTtlDialog
                    count={keys.length}
                    onSubmit={(s) => void applyTtl(s)}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === 'delete' && (
                <Modal
                    title={`Delete ${String(keys.length)} keys?`}
                    onClose={() => setDialog(null)}
                    footer={
                        <>
                            <Button onClick={() => setDialog(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                disabled={busy}
                                onClick={() => void confirmDelete()}
                            >
                                Delete
                            </Button>
                        </>
                    }
                >
                    This permanently removes the selected keys from {env}.
                </Modal>
            )}
        </>
    );
}
