import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiMayDoSection } from '@/pages/Ai/AiMayDoSection';
import * as api from '@/services/apiService';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

beforeEach(() => {
    jest.resetAllMocks();
    mocked.getAiHiddenFields.mockResolvedValue(['password', 'token']);
    mocked.setAiHiddenFields.mockImplementation((f) => Promise.resolve(f));
});

test('adds a name as a chip', async () => {
    const user = userEvent.setup();
    render(<AiMayDoSection />);
    await screen.findByText('password');

    await user.type(screen.getByLabelText('Field name'), 'SSN');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mocked.setAiHiddenFields).toHaveBeenCalledWith([
        'password',
        'token',
        'ssn'
    ]);
    expect(await screen.findByText('ssn')).toBeInTheDocument();
});

test('removes a name with x', async () => {
    const user = userEvent.setup();
    render(<AiMayDoSection />);
    await screen.findByText('password');

    await user.click(screen.getByRole('button', { name: 'Remove password' }));

    expect(mocked.setAiHiddenFields).toHaveBeenCalledWith(['token']);
});

test('rejects empty and duplicate names without saving', async () => {
    const user = userEvent.setup();
    render(<AiMayDoSection />);
    await screen.findByText('password');

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.type(screen.getByLabelText('Field name'), ' Token ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mocked.setAiHiddenFields).not.toHaveBeenCalled();
});
