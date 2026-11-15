import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Job } from '@/types';
import { formatNumber } from '@/utils/formatter';
import { showToast } from '@/utils/toast';
import { useDeleteJob } from './hooks/useDeleteJob';

interface DeleteMatchingProps {
    env: string;
    pattern: string;
    /** SCAN TYPE filter, '' for any. */
    type: string;
    /** Read-only Connection, or a filter the job cannot apply (TTL). */
    disabled: boolean;
    /** Called when the job stops, so the list can refresh. */
    onFinished: () => void;
}

function describe(job: Job): string {
    const deleted = `${formatNumber(job.progress.deleted)} deleted`;
    switch (job.state) {
        case 'running':
            return `Deleting · ${deleted} · ${formatNumber(
                job.progress.scanned
            )} scanned`;
        case 'done':
            return `Done · ${deleted}`;
        case 'cancelled':
            return `Cancelled · ${deleted}`;
        default:
            return `Failed: ${job.error ?? 'unknown error'} · ${deleted}`;
    }
}

/** "Delete all matching" as a server job, with progress and Cancel. */
export function DeleteMatching({
    env,
    pattern,
    type,
    disabled,
    onFinished
}: DeleteMatchingProps) {
    const { job, start, cancel, dismiss } = useDeleteJob(env, onFinished);
    const [confirming, setConfirming] = useState(false);
    const running = job?.state === 'running';

    const report = (e: unknown) =>
        showToast(e instanceof Error ? e.message : String(e), 'error');

    const confirm = () => {
        setConfirming(false);
        start(pattern, type).catch(report);
    };

    return (
        <>
            <Button
                size="sm"
                variant="danger"
                disabled={disabled || running}
                onClick={() => setConfirming(true)}
            >
                Delete all matching…
            </Button>
            {job && (
                <div className="banner" role="status">
                    {describe(job)}
                    {running ? (
                        <Button
                            size="xs"
                            onClick={() => void cancel().catch(report)}
                        >
                            Cancel
                        </Button>
                    ) : (
                        <Button size="xs" onClick={dismiss}>
                            Dismiss
                        </Button>
                    )}
                </div>
            )}
            {confirming && (
                <Modal
                    title={`Delete every key matching ${pattern}?`}
                    onClose={() => setConfirming(false)}
                    footer={
                        <>
                            <Button onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={confirm}>
                                Delete all
                            </Button>
                        </>
                    }
                >
                    {`This permanently removes every key matching ${pattern}${
                        type ? ` of type ${type}` : ''
                    } from ${env}, not only the loaded ones. It runs on the server; you can cancel it.`}
                </Modal>
            )}
        </>
    );
}
