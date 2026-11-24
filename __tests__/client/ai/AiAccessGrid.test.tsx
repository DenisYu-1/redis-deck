import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiAccessGrid } from '@/pages/Ai/AiAccessGrid';
import * as api from '@/services/apiService';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const row = (over: Partial<api.AiAccessRow>): api.AiAccessRow => ({
    id: 'dev',
    tier: 'local',
    readOnly: false,
    keys: true,
    values: true,
    write: true,
    workflows: true,
    ask: false,
    ...over
});

beforeEach(() => {
    jest.resetAllMocks();
    mocked.listAiAccess.mockResolvedValue([
        row({}),
        row({
            id: 'prod',
            tier: 'production',
            values: false,
            write: false,
            workflows: false,
            ask: true
        })
    ]);
});

test('one row per Connection; a change is saved through the server', async () => {
    const user = userEvent.setup();
    mocked.setAiAccess.mockResolvedValue({
        keys: true,
        values: false,
        write: true,
        workflows: true,
        ask: false
    });
    render(<AiAccessGrid />);

    expect(await screen.findAllByTestId('ai-access-row')).toHaveLength(2);
    await user.click(screen.getByLabelText('See values for dev'));
    expect(mocked.setAiAccess).toHaveBeenCalledWith('dev', { values: false });
    expect(screen.getByLabelText('See values for dev')).not.toBeChecked();
});

test('production ask is locked on; write needs see keys', async () => {
    render(<AiAccessGrid />);
    const ask = await screen.findByLabelText('Ask before writes for prod');
    expect(ask).toBeChecked();
    expect(ask).toBeDisabled();
});
