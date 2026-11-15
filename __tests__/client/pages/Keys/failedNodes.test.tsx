import { render, screen } from '@testing-library/react';
import { KeysPage } from '@/pages/Keys/KeysPage';
import { searchKeys } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/services/apiService');

it('warns which Nodes failed and offers to continue past them', async () => {
    (searchKeys as jest.Mock).mockResolvedValue({
        keys: ['a'],
        cursors: ['done', '17'],
        hasMore: true,
        total: '1?',
        meta: { a: { type: 'string', ttl: -1, size: 1 } },
        failedNodes: [
            {
                id: 'bc64',
                address: 'redis-node-2:6379',
                error: 'Connection refused'
            }
        ]
    });
    useAppStore.setState({ currentEnvironment: 'c1' });

    render(<KeysPage />);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('redis-node-2:6379');
    expect(banner).toHaveTextContent('Connection refused');
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
});
