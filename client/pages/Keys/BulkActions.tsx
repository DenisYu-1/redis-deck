import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
    deleteKeys,
    jobResultUrl,
    setKeysTtl,
    startExportJob
} from '@/services/apiService';
import type { ExportProgress, Job } from '@/types';
import { formatNumber } from '@/utils/formatter';
import { showToast } from '@/utils/toast';
import { useJob } from './hooks/useJob';
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

function describe(job: Job<ExportProgress>): string {
    const exported = `${formatNumber(job.progress.exported)} exported`;
    switch (job.state) {
        case 'running':
            return `Exporting · ${exported}`;
        case 'done':
            return `Done · ${exported}${
                job.progress.truncated
                    ? ` (stopped at ${String(EXPORT_CAP)})`
                    : ''
            }`;
        case 'cancelled':
            return `Cancelled · ${exported}`;
        default:
            return `Export failed: ${job.error ?? 'unknown error'}`;
    }
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
    const exportJob = useJob(env, 'export', startExportJob);
    const exporting = exportJob.job;

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
        exportJob.start({ keys }).catch((e: unknown) => {
            showToast(e instanceof Error ? e.message : String(e), 'error');
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
            {exporting && (
                <div className="banner" role="status">
                    {describe(exporting)}
                    {exporting.state === 'done' && (
                        <a href={jobResultUrl(exporting.id)} download>
                            Download
                        </a>
                    )}
                    {exporting.state === 'running' ? (
                        <Button
                            size="xs"
                            onClick={() =>
                                void exportJob.cancel().catch(() => undefined)
                            }
                        >
                            Cancel
                        </Button>
                    ) : (
                        <Button size="xs" onClick={exportJob.dismiss}>
                            Dismiss
                        </Button>
                    )}
                </div>
            )}
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
