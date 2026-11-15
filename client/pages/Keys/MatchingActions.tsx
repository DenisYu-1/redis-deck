import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/utils/toast';
import { EXPORT_CAP } from './JobBanners';
import type { DeleteJob, ExportJob } from './hooks/useKeysJobs';

interface MatchingActionsProps {
    env: string;
    pattern: string;
    /** SCAN TYPE filter, '' for any. */
    type: string;
    /** Read-only Connection: no delete. */
    readOnly: boolean;
    /** A filter the jobs cannot apply (TTL). */
    unsupportedFilter: boolean;
    deleteJob: DeleteJob;
    exportJob: ExportJob;
}

const report = (e: unknown) =>
    showToast(e instanceof Error ? e.message : String(e), 'error');

/** "Delete all matching" and "Export all matching" as server jobs. */
export function MatchingActions({
    env,
    pattern,
    type,
    readOnly,
    unsupportedFilter,
    deleteJob,
    exportJob
}: MatchingActionsProps) {
    const [confirming, setConfirming] = useState<'delete' | 'export' | null>(
        null
    );
    const target = type ? { pattern, type } : { pattern };
    const ofType = type ? ` of type ${type}` : '';

    const start = (job: DeleteJob | ExportJob) => {
        setConfirming(null);
        job.start(target).catch(report);
    };

    return (
        <>
            <Button
                size="sm"
                disabled={
                    unsupportedFilter || exportJob.job?.state === 'running'
                }
                onClick={() => setConfirming('export')}
            >
                Export all matching…
            </Button>
            <Button
                size="sm"
                variant="danger"
                disabled={
                    readOnly ||
                    unsupportedFilter ||
                    deleteJob.job?.state === 'running'
                }
                onClick={() => setConfirming('delete')}
            >
                Delete all matching…
            </Button>
            {confirming === 'delete' && (
                <Modal
                    title={`Delete every key matching ${pattern}?`}
                    onClose={() => setConfirming(null)}
                    footer={
                        <>
                            <Button onClick={() => setConfirming(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => start(deleteJob)}
                            >
                                Delete all
                            </Button>
                        </>
                    }
                >
                    {`This permanently removes every key matching ${pattern}${ofType} from ${env}, not only the loaded ones. It runs on the server; you can cancel it.`}
                </Modal>
            )}
            {confirming === 'export' && (
                <Modal
                    title={`Export every key matching ${pattern}?`}
                    onClose={() => setConfirming(null)}
                    footer={
                        <>
                            <Button onClick={() => setConfirming(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => start(exportJob)}
                            >
                                Export all
                            </Button>
                        </>
                    }
                >
                    {`Exports keys matching ${pattern}${ofType} from ${env}, not only the loaded ones, up to ${String(EXPORT_CAP)} keys. It runs on the server; you can cancel it.`}
                </Modal>
            )}
        </>
    );
}
