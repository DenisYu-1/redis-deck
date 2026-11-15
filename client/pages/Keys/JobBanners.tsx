import { Button } from '@/components/ui/Button';
import { jobResultUrl } from '@/services/apiService';
import type { ExportProgress, Job } from '@/types';
import { formatNumber } from '@/utils/formatter';
import { showToast } from '@/utils/toast';
import type { DeleteJob, ExportJob } from './hooks/useKeysJobs';

export const EXPORT_CAP = 1000;

function describeDelete(job: Job): string {
    const failed = job.progress.failed ?? 0;
    const deleted = `${formatNumber(job.progress.deleted)} deleted${
        failed > 0 ? ` · ${formatNumber(failed)} not deleted` : ''
    }`;
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

function describeExport(job: Job<ExportProgress>): string {
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

const report = (e: unknown) =>
    showToast(e instanceof Error ? e.message : String(e), 'error');

function Banner<P>({
    job,
    text,
    control,
    download
}: {
    job: Job<P>;
    text: string;
    control: { cancel: () => Promise<void>; dismiss: () => void };
    download?: boolean;
}) {
    return (
        <div className="banner" role="status">
            {text}
            {download && job.state === 'done' && (
                <a href={jobResultUrl(job.id)} download>
                    Download
                </a>
            )}
            {job.state === 'running' ? (
                <Button
                    size="xs"
                    onClick={() => void control.cancel().catch(report)}
                >
                    Cancel
                </Button>
            ) : (
                <Button size="xs" onClick={control.dismiss}>
                    Dismiss
                </Button>
            )}
        </div>
    );
}

/** Progress, Cancel and Download for the Keys page's bulk jobs. */
export function JobBanners({
    deleteJob,
    exportJob
}: {
    deleteJob: DeleteJob;
    exportJob: ExportJob;
}) {
    return (
        <>
            {deleteJob.job && (
                <Banner
                    job={deleteJob.job}
                    text={describeDelete(deleteJob.job)}
                    control={deleteJob}
                />
            )}
            {exportJob.job && (
                <Banner
                    job={exportJob.job}
                    text={describeExport(exportJob.job)}
                    control={exportJob}
                    download
                />
            )}
        </>
    );
}
