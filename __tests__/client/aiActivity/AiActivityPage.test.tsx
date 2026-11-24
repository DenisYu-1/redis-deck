import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AiActivityPage } from '@/pages/AiActivity/AiActivityPage';
import * as api from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { RedisConnection } from '@/types';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

beforeEach(() => {
    jest.resetAllMocks();
    useAppStore.setState({
        connections: [{ id: 'prod' }, { id: 'dev' }] as RedisConnection[]
    });
    mocked.listAiActivity.mockResolvedValue({
        total: 1,
        entries: [
            {
                id: 1,
                time: Date.now(),
                client: 'claude-code',
                connectionId: 'prod',
                operation: 'set_key',
                target: 'user:1',
                result: 'denied',
                error: 'The user denied set_key'
            }
        ]
    });
});

test('shows entries as a page table and filters by Connection', async () => {
    const user = userEvent.setup();
    render(
        <MemoryRouter>
            <AiActivityPage />
        </MemoryRouter>
    );

    expect(await screen.findAllByTestId('ai-activity-row')).toHaveLength(1);
    expect(screen.getByText('The user denied set_key')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Connection'), 'prod');
    await waitFor(() =>
        expect(mocked.listAiActivity).toHaveBeenLastCalledWith({
            connectionId: 'prod',
            limit: 50,
            offset: 0
        })
    );
});
