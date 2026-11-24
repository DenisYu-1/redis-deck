import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiToolsSection } from '@/pages/Ai/AiToolsSection';
import * as api from '@/services/apiService';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const tools = [
    { name: 'get_key', description: 'Read a Key', write: false, enabled: true },
    { name: 'set_key', description: 'Write a Key', write: true, enabled: true },
    {
        name: 'run_workflow',
        description: 'Run a Workflow',
        write: true,
        enabled: false
    }
];

test('lists the registered tools with switch state and toggles one', async () => {
    const user = userEvent.setup();
    mocked.listAiTools.mockResolvedValue(tools);
    mocked.setAiToolEnabled.mockResolvedValue(
        tools.map((t) => (t.name === 'get_key' ? { ...t, enabled: false } : t))
    );
    render(<AiToolsSection />);

    const getKey = await screen.findByRole('checkbox', { name: 'get_key' });
    expect(getKey).toBeChecked();
    expect(
        screen.getByRole('checkbox', { name: 'run_workflow' })
    ).not.toBeChecked();
    expect(screen.getAllByText('write')).toHaveLength(2);
    expect(screen.getByText(/Connection guards still apply/)).toBeVisible();

    await user.click(getKey);
    expect(mocked.setAiToolEnabled).toHaveBeenCalledWith('get_key', false);
    await waitFor(() => expect(getKey).not.toBeChecked());
});
