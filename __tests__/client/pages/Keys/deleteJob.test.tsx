import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteMatching } from '@/pages/Keys/DeleteMatching';
import {
    cancelJob,
    getJob,
    listJobs,
    startDeleteJob
} from '@/services/apiService';
import type { Job } from '@/types';

jest.mock('@/services/apiService');

const job = (over: Partial<Job> = {}): Job => ({
    id: 'j1',
    kind: 'delete',
    env: 'c1',
    state: 'running',
    progress: { scanned: 40, deleted: 25 },
    startedAt: 0,
    ...over
});

const props = {
    env: 'c1',
    pattern: 'user:*',
    type: '',
    readOnly: false,
    onFinished: jest.fn()
};

beforeEach(() => {
    jest.resetAllMocks();
    (listJobs as jest.Mock).mockResolvedValue([]);
});

it('starts a delete job for the pattern and shows its progress', async () => {
    (startDeleteJob as jest.Mock).mockResolvedValue(job());
    (getJob as jest.Mock).mockResolvedValue(job());
    render(<DeleteMatching {...props} />);

    await userEvent.click(
        screen.getByRole('button', { name: 'Delete all matching…' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));

    expect(startDeleteJob).toHaveBeenCalledWith(
        { pattern: 'user:*', type: undefined },
        'c1'
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
        'Deleting user:* · 25 deleted · 40 scanned'
    );
});

it('picks up a running job after navigating back, and cancels it', async () => {
    (listJobs as jest.Mock).mockResolvedValue([job()]);
    (getJob as jest.Mock).mockResolvedValue(job());
    (cancelJob as jest.Mock).mockResolvedValue(
        job({ state: 'cancelled', progress: { scanned: 40, deleted: 30 } })
    );
    render(<DeleteMatching {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(cancelJob).toHaveBeenCalledWith('j1');
    expect(await screen.findByRole('status')).toHaveTextContent(
        'Cancelled · 30 deleted'
    );
    expect(props.onFinished).toHaveBeenCalled();
});

it('reports a failed job with its error', async () => {
    (startDeleteJob as jest.Mock).mockResolvedValue(job());
    (getJob as jest.Mock).mockResolvedValue(
        job({ state: 'failed', error: 'Could not scan n2:6379; stopped' })
    );
    render(<DeleteMatching {...props} />);
    await userEvent.click(
        screen.getByRole('button', { name: 'Delete all matching…' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    await waitFor(
        () =>
            expect(screen.getByRole('status')).toHaveTextContent(
                'Failed: Could not scan n2:6379; stopped · 25 deleted'
            ),
        { timeout: 3000 }
    );
});

it('is disabled on a read-only Connection', () => {
    render(<DeleteMatching {...props} readOnly />);
    expect(
        screen.getByRole('button', { name: 'Delete all matching…' })
    ).toBeDisabled();
});
