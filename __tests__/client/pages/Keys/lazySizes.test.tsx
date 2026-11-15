import { render, screen, waitFor } from '@testing-library/react';
import { KeysPage } from '@/pages/Keys/KeysPage';
import { getKeySizes, searchKeys } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/services/apiService');

const sizeCell = (key: string) =>
    screen
        .getByRole('checkbox', { name: `Select ${key}` })
        .closest('.krow')!
        .querySelector('.c-size')!;

beforeEach(() => jest.clearAllMocks());

it('clustered rows show a placeholder, then sizes fetched once for visible rows only', async () => {
    (searchKeys as jest.Mock).mockResolvedValue({
        keys: ['a', 'b'],
        cursors: ['done'],
        hasMore: false,
        total: 2,
        failedNodes: [],
        meta: {
            a: { type: 'string', ttl: -1, node: 'n1' },
            b: { type: 'hash', ttl: -1, node: 'n2' }
        }
    });
    let resolve: (v: unknown) => void = () => {};
    (getKeySizes as jest.Mock).mockReturnValue(
        new Promise((r) => (resolve = r))
    );
    useAppStore.setState({ currentEnvironment: 'c1' });

    render(<KeysPage />);

    await screen.findByRole('checkbox', { name: 'Select a' });
    expect(sizeCell('a')).toHaveTextContent('…');
    await waitFor(() => expect(getKeySizes).toHaveBeenCalledTimes(1));
    // jsdom has no layout: only the first row counts as visible.
    expect(getKeySizes).toHaveBeenCalledWith([{ key: 'a', node: 'n1' }], 'c1');
    resolve({ a: 2048 });
    await waitFor(() => expect(sizeCell('a')).toHaveTextContent('2 KB'));
    expect(sizeCell('b')).toHaveTextContent('…');
    expect(getKeySizes).toHaveBeenCalledTimes(1); // no refetch once filled
});

it('non-clustered rows carry size inline and fetch nothing', async () => {
    (searchKeys as jest.Mock).mockResolvedValue({
        keys: ['a'],
        cursors: ['0'],
        hasMore: false,
        total: 1,
        failedNodes: [],
        meta: { a: { type: 'string', ttl: -1, size: 2048 } }
    });
    useAppStore.setState({ currentEnvironment: 'c1' });

    render(<KeysPage />);

    await screen.findByRole('checkbox', { name: 'Select a' });
    expect(sizeCell('a')).toHaveTextContent('2 KB');
    expect(getKeySizes).not.toHaveBeenCalled();
});
