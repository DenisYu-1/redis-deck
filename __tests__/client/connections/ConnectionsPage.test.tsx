import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionsPage } from '@/pages/Connections/ConnectionsPage';
import * as api from '@/services/apiService';
import type { RedisConnection } from '@/types';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const conn = (over: Partial<RedisConnection>): RedisConnection => ({
    id: 'x',
    host: 'h',
    port: 6379,
    tls: false,
    cluster: false,
    db: 0,
    tier: 'local',
    verifyTls: true,
    readOnly: false,
    confirmWrites: false,
    hasPassword: false,
    ...over
});

const findName = (name: string) =>
    screen.findByText(name, { selector: '.cname' });

beforeEach(() => {
    jest.resetAllMocks();
    mocked.loadEnvironments.mockResolvedValue([
        conn({ id: 'dev' }),
        conn({
            id: 'prod',
            host: 'prod.example.com',
            tier: 'production',
            hasPassword: true,
            readOnly: true
        }),
        conn({ id: 'stage', tier: 'staging' })
    ]);
    mocked.updateConnection.mockResolvedValue();
    mocked.addConnection.mockResolvedValue();
    mocked.deleteConnection.mockResolvedValue();
    mocked.reorderConnections.mockResolvedValue();
    mocked.testConnectionDraft.mockResolvedValue({
        success: true,
        message: 'Connection successful'
    });
});

test('lists connections with tier and guard', async () => {
    render(<ConnectionsPage />);
    expect(await findName('prod')).toBeInTheDocument();
    expect(screen.getByText('prod.example.com:6379')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
});

test('pasting a URI fills the form and password stays masked', async () => {
    const user = userEvent.setup();
    render(<ConnectionsPage />);
    await findName('prod');
    await user.click(screen.getByRole('button', { name: /add connection/i }));

    await user.click(screen.getByLabelText(/connection uri/i));
    await user.paste('rediss://alice:s3cret@cache.example.com:6380/4');

    expect(screen.getByLabelText('Host')).toHaveValue('cache.example.com');
    expect(screen.getByLabelText('Port')).toHaveValue('6380');
    expect(screen.getByLabelText('DB')).toHaveValue('4');
    expect(screen.getByLabelText('ACL user')).toHaveValue('alice');
    expect(screen.getByLabelText('TLS')).toBeChecked();
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    expect(pw).toHaveValue('s3cret');
});

test('editing keeps the stored password: masked placeholder, blank save sends none', async () => {
    const user = userEvent.setup();
    render(<ConnectionsPage />);
    await user.click(await findName('prod'));

    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    expect(pw).toHaveValue('');
    expect(pw).toHaveAttribute(
        'placeholder',
        expect.stringMatching(/unchanged/i)
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocked.updateConnection).toHaveBeenCalled());
    const sent = mocked.updateConnection.mock.calls[0][0];
    expect(sent).not.toHaveProperty('password');
    expect(sent).toMatchObject({
        id: 'prod',
        tier: 'production',
        readOnly: true
    });
});

test('test works for a saved connection (sends id) and shows the result', async () => {
    const user = userEvent.setup();
    render(<ConnectionsPage />);
    await user.click(await findName('prod'));
    await user.click(screen.getByRole('button', { name: 'Test' }));
    await waitFor(() =>
        expect(mocked.testConnectionDraft).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'prod', host: 'prod.example.com' })
        )
    );
    expect(
        await screen.findByText('Connection successful')
    ).toBeInTheDocument();
});

test('test works for an unsaved connection', async () => {
    const user = userEvent.setup();
    render(<ConnectionsPage />);
    await findName('prod');
    await user.click(screen.getByRole('button', { name: /add connection/i }));
    await user.type(screen.getByLabelText('Host'), 'new.host');
    await user.click(screen.getByRole('button', { name: 'Test' }));
    await waitFor(() =>
        expect(mocked.testConnectionDraft).toHaveBeenCalledWith(
            expect.objectContaining({ host: 'new.host' })
        )
    );
});

test('creating requires a name', async () => {
    const user = userEvent.setup();
    render(<ConnectionsPage />);
    await findName('prod');
    await user.click(screen.getByRole('button', { name: /add connection/i }));
    await user.type(screen.getByLabelText('Host'), 'h2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocked.addConnection).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Name'), 'fresh');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
        expect(mocked.addConnection).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'fresh', host: 'h2' })
        )
    );
});

test('delete asks for confirmation then deletes', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ConnectionsPage />);
    await user.click(await findName('stage'));
    await user.click(
        screen.getByRole('button', { name: /delete connection/i })
    );
    await waitFor(() =>
        expect(mocked.deleteConnection).toHaveBeenCalledWith('stage')
    );
});

test('dragging a row reorders and persists the new order', async () => {
    render(<ConnectionsPage />);
    await findName('prod');
    const rows = () => screen.getAllByTestId('conn-row');
    const dataTransfer = { setData: jest.fn(), effectAllowed: '' };
    fireEvent.dragStart(rows()[0], { dataTransfer });
    fireEvent.dragOver(rows()[2], { dataTransfer });
    fireEvent.drop(rows()[2], { dataTransfer });
    await waitFor(() =>
        expect(mocked.reorderConnections).toHaveBeenCalledWith([
            'prod',
            'stage',
            'dev'
        ])
    );
});
