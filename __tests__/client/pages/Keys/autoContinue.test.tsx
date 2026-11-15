import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeysPage } from '@/pages/Keys/KeysPage';
import { searchKeys } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { SearchKeysResponse } from '@/types';

jest.mock('@/services/apiService');

const partial = (cursor: string, returned: number): SearchKeysResponse => ({
    keys: [],
    cursors: [cursor],
    hasMore: true,
    total: '0?',
    meta: {},
    failedNodes: [],
    scan: { iterations: 4, returned, matched: 0, ms: 2000 }
});

beforeEach(() => {
    (searchKeys as jest.Mock).mockReset();
    useAppStore.setState({ currentEnvironment: 'c1' });
});

it('continues a partial search until the scan ends', async () => {
    (searchKeys as jest.Mock)
        .mockResolvedValueOnce(partial('11', 3))
        .mockResolvedValueOnce(partial('22', 4))
        .mockResolvedValueOnce({
            keys: ['rare'],
            cursors: ['0'],
            hasMore: false,
            total: 1,
            meta: { rare: { type: 'string', ttl: -1, size: 1 } },
            failedNodes: [],
            scan: { iterations: 1, returned: 1, matched: 1, ms: 5 }
        });

    render(<KeysPage />);

    expect(await screen.findByText('rare')).toBeInTheDocument();
    const calls = (searchKeys as jest.Mock).mock.calls;
    expect(calls.map((c) => c[1])).toEqual([['0'], ['11'], ['22']]);
    expect(
        screen.queryByRole('button', { name: 'Load more' })
    ).not.toBeInTheDocument();
});

it('shows scanned progress and lets the user stop', async () => {
    let calls = 0;
    (searchKeys as jest.Mock).mockImplementation(
        (_p: string, _c: string[], _n: number, _e: string, signal: AbortSignal) => {
            calls++;
            if (calls === 1) return Promise.resolve(partial('11', 7));
            // Second request hangs until aborted.
            return new Promise((_, reject) =>
                signal.addEventListener('abort', () =>
                    reject(new DOMException('aborted', 'AbortError'))
                )
            );
        }
    );

    render(<KeysPage />);

    expect(await screen.findByRole('status')).toHaveTextContent('scanned 7');
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

    // Stopped: resumable from the last cursor set, no further requests.
    const more = await screen.findByRole('button', { name: 'Load more' });
    expect(more).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(calls).toBe(2);

    (searchKeys as jest.Mock).mockResolvedValue({
        ...partial('0', 0),
        hasMore: false
    });
    await userEvent.click(more);
    await waitFor(() =>
        expect((searchKeys as jest.Mock).mock.calls[2][1]).toEqual(['11'])
    );
});
