import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewKeyModal } from '@/pages/Keys/NewKeyModal';
import * as api from '@/services/apiService';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const onCreated = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
    jest.resetAllMocks();
    mocked.saveKey.mockResolvedValue({ success: true });
    render(<NewKeyModal env="dev" onClose={onClose} onCreated={onCreated} />);
});

test('creates a hash with a TTL and reports the key', async () => {
    await userEvent.type(screen.getByLabelText('Key name'), 'user:1');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'hash');
    await userEvent.type(screen.getByLabelText('Value'), 'a=1');
    await userEvent.type(screen.getByLabelText('TTL'), '5m');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mocked.saveKey).toHaveBeenCalledWith(
        'user:1',
        { a: '1' },
        300,
        'dev',
        'hash'
    );
    expect(onCreated).toHaveBeenCalledWith('user:1');
    expect(onClose).toHaveBeenCalled();
});

test('rejects an empty name without calling the API', async () => {
    await userEvent.type(screen.getByLabelText('Value'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mocked.saveKey).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
});

test('a server refusal stays in the dialog', async () => {
    mocked.saveKey.mockRejectedValue(new Error('read-only'));
    await userEvent.type(screen.getByLabelText('Key name'), 'k');
    await userEvent.type(screen.getByLabelText('Value'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert')).toHaveTextContent('read-only');
    expect(onCreated).not.toHaveBeenCalled();
});
