import { startDeleteJob, startExportJob } from '@/services/apiService';
import type { DeleteProgress, ExportProgress } from '@/types';
import { useJob, type JobControl } from './useJob';

export type JobTarget = { pattern: string; type?: string } | { keys: string[] };
export type DeleteJob = JobControl<DeleteProgress, JobTarget>;
export type ExportJob = JobControl<ExportProgress, JobTarget>;

/**
 * The Keys page's bulk jobs. One owner per kind, so the selection bar and the
 * "all matching" actions share one job and one banner.
 */
export function useKeysJobs(env: string, onDeleted: () => void) {
    const deleteJob: DeleteJob = useJob(
        env,
        'delete',
        startDeleteJob,
        onDeleted
    );
    const exportJob: ExportJob = useJob(env, 'export', startExportJob);
    return { deleteJob, exportJob };
}
