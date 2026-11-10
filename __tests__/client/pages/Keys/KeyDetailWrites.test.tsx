import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyDetail } from '@/pages/Keys/KeyDetail';
import { useAppStore } from '@/store/useAppStore';
import * as api from '@/services/apiService';
import type { KeyDetails, RedisConnection } from '@/types';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const base = {
    host: 'h',
    port: 1,
    tls: false,
    cluster: false,
    db: 0,
    tier: 'local',
    verifyTls: true,
    confirmWrites: false
} as const;
const conns: RedisConnection[] = [
    { ...base, id: 'dev', readOnly: false },
    { ...base, id: 'ro', readOnly: true }
];

const onChanged = jest.fn();

function show(details: KeyDetails) {
    return render(
        <KeyDetail
            keyName={details.key}
            details={details}
            info={null}
            loading={false}
            error={null}
            onReload={jest.fn()}
            onChanged={onChanged}
        />
    );
}

const str: KeyDetails = { key: 'a:b', type: 'string', ttl: 120, value: 'hi' };

beforeEach(() => {
    jest.resetAllMocks();
    onChanged.mockReset();
    mocked.renameKey.mockResolvedValue({ success: true });
    mocked.copyKey.mockResolvedValue({ success: true });
    mocked.setTTL.mockResolvedValue({ success: true });
    mocked.saveKey.mockResolvedValue({ success: true });
    mocked.addMember.mockResolvedValue({ success: true, type: 'hash' });
    mocked.deleteKey.mockResolvedValue({ success: true, deletedCount: 1 });
    useAppStore.setState({ connections: conns, currentEnvironment: 'dev' });
});

async function submit(button: string) {
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: button }));
}

test('rename sends the new name and selects it', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('New name');
    await userEvent.clear(input);
    await userEvent.type(input, 'a:c');
    await submit('Rename');
    expect(mocked.renameKey).toHaveBeenCalledWith('a:b', 'a:c', 'dev');
    expect(onChanged).toHaveBeenCalledWith('a:c');
});

test('copy to name keeps the original selected', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Copy to…' }));
    await userEvent.clear(screen.getByLabelText('Copy to name'));
    await userEvent.type(screen.getByLabelText('Copy to name'), 'a:copy');
    await submit('Copy');
    expect(mocked.copyKey).toHaveBeenCalledWith('a:b', 'a:copy', 'dev', 'dev');
    expect(onChanged).toHaveBeenCalledWith();
});

test('TTL edit parses units; blank removes the expiry', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Set TTL' }));
    const input = screen.getByLabelText('TTL');
    await userEvent.clear(input);
    await userEvent.type(input, '5m');
    await submit('Save');
    expect(mocked.setTTL).toHaveBeenCalledWith('a:b', 300, 'dev');

    await userEvent.click(screen.getByRole('button', { name: 'Set TTL' }));
    await userEvent.clear(screen.getByLabelText('TTL'));
    await submit('Save');
    expect(mocked.setTTL).toHaveBeenLastCalledWith('a:b', -1, 'dev');
});

test('an invalid TTL keeps the dialog open with an error', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Set TTL' }));
    const input = screen.getByLabelText('TTL');
    await userEvent.clear(input);
    await userEvent.type(input, 'soon');
    await submit('Save');
    expect(mocked.setTTL).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/TTL/);
});

test('delete asks first, then deselects the key', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mocked.deleteKey).not.toHaveBeenCalled();
    await submit('Delete key');
    expect(mocked.deleteKey).toHaveBeenCalledWith('a:b', 'dev');
    expect(onChanged).toHaveBeenCalledWith(null);
});

test('edit string saves the value and preserves the TTL', async () => {
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Edit value' }));
    const box = screen.getByLabelText('Value');
    await userEvent.clear(box);
    await userEvent.type(box, 'bye');
    await submit('Save');
    expect(mocked.saveKey).toHaveBeenCalledWith(
        'a:b',
        'bye',
        120,
        'dev',
        'string'
    );
    expect(onChanged).toHaveBeenCalledWith();
});

test('add hash field', async () => {
    show({ key: 'h', type: 'hash', ttl: -1, value: { a: '1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));
    await userEvent.type(screen.getByLabelText('Field'), 'b');
    await userEvent.type(screen.getByLabelText('Value'), '2');
    await submit('Add');
    expect(mocked.addMember).toHaveBeenCalledWith(
        'h',
        { field: 'b', value: '2' },
        'dev'
    );
    expect(onChanged).toHaveBeenCalledWith();
});

test('zadd member with score', async () => {
    show({ key: 'z', type: 'zset', ttl: -1, value: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await userEvent.type(screen.getByLabelText('Member'), 'm');
    await userEvent.type(screen.getByLabelText('Score'), '2.5');
    await submit('Add');
    expect(mocked.addMember).toHaveBeenCalledWith(
        'z',
        { member: 'm', score: 2.5 },
        'dev'
    );
});

test('a refused write (403) keeps the dialog open with the message', async () => {
    mocked.deleteKey.mockRejectedValue(
        new Error("Connection 'dev' is read-only")
    );
    show(str);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await submit('Delete key');
    expect(screen.getByRole('alert')).toHaveTextContent(/read-only/);
    expect(onChanged).not.toHaveBeenCalled();
});

test('Read-only connection disables write controls with a title', () => {
    useAppStore.setState({ currentEnvironment: 'ro' });
    show({ key: 'h', type: 'hash', ttl: 5, value: { a: '1' } });
    for (const name of [
        'Rename',
        'Copy to…',
        'Set TTL',
        'Delete',
        'Add field'
    ]) {
        const b = screen.getByRole('button', { name });
        expect(b).toBeDisabled();
        expect(b).toHaveAttribute('title', expect.stringMatching(/read-only/i));
    }
});
