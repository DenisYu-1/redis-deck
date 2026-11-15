import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActions as Selection } from '@/pages/Keys/BulkActions';
import { JobBanners } from '@/pages/Keys/JobBanners';
import { useKeysJobs } from '@/pages/Keys/hooks/useKeysJobs';
import {
    cancelJob,
    getJob,
    jobResultUrl,
    listJobs,
    startExportJob
} from '@/services/apiService';
import type { ExportProgress, Job } from '@/types';

jest.mock('@/services/apiService');

const job = (over: Partial<Job<ExportProgress>> = {}): Job<ExportProgress> => ({
    id: 'j1',
    kind: 'export',
    env: 'c1',
    state: 'running',
    progress: { scanned: 2, exported: 2, truncated: false },
    startedAt: 0,
    ...over
});

const props = {
    env: 'c1',
    readOnly: false,
    keys: ['a', 'b', 'c'],
    matched: 3,
    onClear: jest.fn(),
    onChanged: jest.fn()
};

// The selection actions and the banners wired like the Keys page wires them.
function BulkActions(p: typeof props) {
    const { deleteJob, exportJob } = useKeysJobs(p.env, p.onChanged);
    return (
        <>
            <Selection {...p} deleteJob={deleteJob} exportJob={exportJob} />
            <JobBanners deleteJob={deleteJob} exportJob={exportJob} />
        </>
    );
}

beforeEach(() => {
    jest.resetAllMocks();
    (listJobs as jest.Mock).mockResolvedValue([]);
    (jobResultUrl as jest.Mock).mockImplementation(
        (id: string) => `/api/jobs/${id}/result`
    );
});

it('exports the selection as a job and offers the download when done', async () => {
    (startExportJob as jest.Mock).mockResolvedValue(job());
    (getJob as jest.Mock).mockResolvedValue(
        job({
            state: 'done',
            progress: { scanned: 3, exported: 3, truncated: false }
        })
    );
    render(<BulkActions {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(startExportJob).toHaveBeenCalledWith({ keys: props.keys }, 'c1');
    expect(screen.getByRole('status')).toHaveTextContent(
        'Exporting · 2 exported'
    );

    const link = await screen.findByRole('link', { name: 'Download' });
    expect(link).toHaveAttribute('href', '/api/jobs/j1/result');
    expect(screen.getByRole('status')).toHaveTextContent('Done · 3 exported');
});

it('cancels a running export', async () => {
    (startExportJob as jest.Mock).mockResolvedValue(job());
    (getJob as jest.Mock).mockResolvedValue(job());
    (cancelJob as jest.Mock).mockResolvedValue(job({ state: 'cancelled' }));
    render(<BulkActions {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(cancelJob).toHaveBeenCalledWith('j1');
    expect(screen.getByRole('status')).toHaveTextContent(
        'Cancelled · 2 exported'
    );
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
});

it('refuses more than 1000 selected Keys without starting a job', async () => {
    const keys = Array.from({ length: 1001 }, (_, i) => `k${String(i)}`);
    render(<BulkActions {...props} keys={keys} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(startExportJob).not.toHaveBeenCalled();
});
