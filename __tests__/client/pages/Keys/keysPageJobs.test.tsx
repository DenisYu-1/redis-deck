import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeysPage } from '@/pages/Keys/KeysPage';
import {
    cancelJob,
    getJob,
    listJobs,
    searchKeys,
    startDeleteJob,
    startExportJob
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { ExportProgress, Job } from '@/types';

jest.mock('@/services/apiService');

const deleting = (over: Partial<Job> = {}): Job => ({
    id: 'd1',
    kind: 'delete',
    env: 'c1',
    state: 'running',
    progress: { scanned: 1, deleted: 1, failed: 0 },
    startedAt: 0,
    ...over
});

const exporting: Job<ExportProgress> = {
    id: 'e1',
    kind: 'export',
    env: 'c1',
    state: 'running',
    progress: { scanned: 0, exported: 0, truncated: false },
    startedAt: 0
};

// Job banners (the scan line is a status too).
const banners = () =>
    screen
        .queryAllByRole('status')
        .filter((e) => e.classList.contains('banner'));
const banner = async () => {
    await waitFor(() => expect(banners()).toHaveLength(1));
    return banners()[0];
};

beforeEach(() => {
    jest.resetAllMocks();
    useAppStore.setState({
        currentEnvironment: 'c1',
        keyPattern: 'user:*',
        connections: [
            { id: 'c1', host: 'h', port: 1, tls: false, cluster: true }
        ]
    });
    (listJobs as jest.Mock).mockResolvedValue([]);
    (searchKeys as jest.Mock).mockResolvedValue({
        keys: ['k1', 'k2'],
        cursors: ['done'],
        hasMore: false,
        total: 2,
        meta: {},
        failedNodes: [],
        scan: { iterations: 1, returned: 2, matched: 2, ms: 1 }
    });
});

it('deletes the selection through the delete job, with progress and Cancel', async () => {
    (startDeleteJob as jest.Mock).mockResolvedValue(deleting());
    (getJob as jest.Mock).mockResolvedValue(deleting());
    (cancelJob as jest.Mock).mockResolvedValue(
        deleting({ state: 'cancelled' })
    );
    render(<KeysPage />);

    await userEvent.click(await screen.findByLabelText('Select k1'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(
        within(dialog).getByRole('button', { name: 'Delete' })
    );

    expect(startDeleteJob).toHaveBeenCalledWith({ keys: ['k1'] }, 'c1');
    const shown = await banner();
    expect(shown).toHaveTextContent('Deleting · 1 deleted');
    await userEvent.click(
        within(shown).getByRole('button', { name: 'Cancel' })
    );
    expect(cancelJob).toHaveBeenCalledWith('d1');
});

it('exports all matching Keys through the export job', async () => {
    (startExportJob as jest.Mock).mockResolvedValue(exporting);
    (getJob as jest.Mock).mockResolvedValue(exporting);
    render(<KeysPage />);

    await userEvent.click(
        await screen.findByRole('button', { name: 'Export all matching…' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export all' }));

    expect(startExportJob).toHaveBeenCalledWith({ pattern: 'user:*' }, 'c1');
    expect(await banner()).toHaveTextContent('Exporting · 0 exported');
});

it('a running delete job picked up after navigating shows one banner', async () => {
    (listJobs as jest.Mock).mockImplementation((env: string, kind: string) =>
        Promise.resolve(kind === 'delete' ? [deleting()] : [])
    );
    (getJob as jest.Mock).mockResolvedValue(deleting());
    render(<KeysPage />);

    expect(await banner()).toHaveTextContent('Deleting');
    await new Promise((r) => setTimeout(r, 50));
    expect(banners()).toHaveLength(1);
});

it('reports Keys the delete job could not delete', async () => {
    (startDeleteJob as jest.Mock).mockResolvedValue(deleting());
    (getJob as jest.Mock).mockResolvedValue(
        deleting({
            state: 'done',
            progress: { scanned: 3, deleted: 2, failed: 1 }
        })
    );
    render(<KeysPage />);
    await userEvent.click(
        await screen.findByRole('button', { name: 'Delete all matching…' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    await waitFor(
        () =>
            expect(banners()[0]).toHaveTextContent(
                'Done · 2 deleted · 1 not deleted'
            ),
        { timeout: 3000 }
    );
});
