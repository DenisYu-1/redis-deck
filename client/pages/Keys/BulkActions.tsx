import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { setKeysTtl } from '@/services/apiService';
import { showToast } from '@/utils/toast';
import { EXPORT_CAP } from './JobBanners';
import type { DeleteJob, ExportJob } from './hooks/useKeysJobs';
import { BulkTtlDialog } from './BulkTtlDialog';
import { SelectionBar } from './SelectionBar';

type Dialog = 'ttl' | 'delete' | null;

interface BulkActionsProps {
    env: string;
    readOnly: boolean;
    keys: string[];
    matched: number;
    onClear: () => void;
    /** Called after a write so the list can refresh. */
    onChanged: () => void;
    deleteJob: DeleteJob;
    exportJob: ExportJob;
}

const report = (e: unknown) =>
    showToast(e instanceof Error ? e.message : String(e), 'error');

/** Actions on the selected Keys; delete and export run as server jobs. */
export function BulkActions({
    env,
    readOnly,
    keys,
    matched,
    onClear,
    onChanged,
    deleteJob,
    exportJob
}: BulkActionsProps) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);

    const applyTtl = async (seconds: number | null) => {
        setBusy(true);
        try {
            const { updated } = await setKeysTtl(keys, seconds, env);
            showToast(
                `${seconds === null ? 'Removed expiry on' : 'Set TTL on'} ${String(updated)} keys`
            );
            onChanged();
        } catch (e) {
            report(e);
        } finally {
            setBusy(false);
            setDialog(null);
        }
    };

    const confirmDelete = () => {
        setDialog(null);
        deleteJob.start({ keys }).then(onClear).catch(report);
    };

    const doExport = () => {
        if (keys.length > EXPORT_CAP) {
            showToast(
                `Export is limited to ${String(EXPORT_CAP)} keys; ${String(keys.length)} selected`,
                'error'
            );
            return;
        }
        exportJob.start({ keys }).catch(report);
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
                                onClick={confirmDelete}
                            >
                                Delete
                            </Button>
                        </>
                    }
                >
                    This permanently removes the selected keys from {env}. It
                    runs on the server; you can cancel it.
                </Modal>
            )}
        </>
    );
}
