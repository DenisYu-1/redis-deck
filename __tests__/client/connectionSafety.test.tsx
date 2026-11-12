import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { ConfirmWriteHost } from '@/components/ui/ConfirmWriteHost';
import { useAppStore } from '@/store/useAppStore';
import { saveKey, deleteKey } from '@/services/apiService';
import { subscribeToasts } from '@/utils/toast';
import type { RedisConnection } from '@/types';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/pages/Connections/ConnectionsPage', () => ({
    ConnectionsPage: () => <div>CONNECTIONS PAGE</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS PAGE</div>
}));

const base = { host: 'h', port: 1, tls: false, cluster: false, db: 0 };
const conns: RedisConnection[] = [
    {
        ...base,
        id: 'dev',
        tier: 'local',
        verifyTls: true,
        readOnly: false,
        confirmWrites: false
    },
    {
        ...base,
        id: 'prod-ro',
        tier: 'production',
        verifyTls: true,
        readOnly: true,
        confirmWrites: false
    },
    {
        ...base,
        id: 'prod-cw',
        tier: 'production',
        verifyTls: true,
        readOnly: false,
        confirmWrites: true
    }
];

const fetchMock = jest.fn();
beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/connections') {
            return { ok: true, json: async () => ({ connections: conns }) };
        }
        if (url.startsWith('/api/info')) {
            return {
                ok: true,
                json: async () => ({ server: { redis_version: '7' } })
            };
        }
        if (url.startsWith('/api/keycount')) {
            return { ok: true, json: async () => ({ count: 1 }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    useAppStore.setState({
        connections: conns,
        currentEnvironment: 'dev',
        isLoading: false
    });
});

function renderApp() {
    return render(
        <MemoryRouter initialEntries={['/keys']}>
            <AppRoutes />
        </MemoryRouter>
    );
}

describe('tier badges and production banner', () => {
    it('shows tier badges in the switcher menu', async () => {
        const user = userEvent.setup();
        renderApp();
        await user.click(await screen.findByRole('button', { name: /dev/ }));
        const menu = screen.getByRole('menu');
        expect(menu).toHaveTextContent('local');
        expect(menu.querySelectorAll('.env.production')).toHaveLength(2);
    });

    it('no banner on a local connection', async () => {
        renderApp();
        await screen.findByText('KEYS PAGE');
        expect(screen.queryByTestId('prod-banner')).toBeNull();
    });

    it('read-only production connection says writes are blocked', async () => {
        useAppStore.setState({ currentEnvironment: 'prod-ro' });
        renderApp();
        const banner = await screen.findByTestId('prod-banner');
        expect(banner).toHaveTextContent('prod-ro');
        expect(banner).toHaveTextContent(/Read-only/);
    });

    it('confirm-writes production connection says to type the name', async () => {
        useAppStore.setState({ currentEnvironment: 'prod-cw' });
        renderApp();
        expect(await screen.findByTestId('prod-banner')).toHaveTextContent(
            /type the connection name/
        );
    });
});

describe('writes against guarded connections', () => {
    it('surfaces a 403 refusal as an error toast and rejects', async () => {
        const toasts: string[] = [];
        const off = subscribeToasts((t) => {
            toasts.splice(0, toasts.length, ...t.map((x) => x.message));
        });
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () =>
                JSON.stringify({ error: "Connection 'prod-ro' is read-only" })
        });
        await expect(deleteKey('k', 'prod-ro')).rejects.toThrow(/read-only/);
        expect(toasts.join(' ')).toMatch(/read-only/);
        off();
    });

    it('asks for the connection name in a modal and sends the header', async () => {
        const user = userEvent.setup();
        render(<ConfirmWriteHost />);
        const done = saveKey('k', 'v', null, 'prod-cw');
        const dialog = await screen.findByRole('dialog');
        const confirm = within(dialog).getByRole('button', {
            name: 'Confirm write'
        });
        expect(confirm).toBeDisabled();
        await user.type(
            within(dialog).getByLabelText(/connection name/i),
            'prod-cw'
        );
        await user.click(confirm);
        await done;
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(
            (init.headers as Record<string, string>)['X-Confirm-Connection']
        ).toBe('prod-cw');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not send the write when the modal is cancelled', async () => {
        const user = userEvent.setup();
        render(<ConfirmWriteHost />);
        const done = saveKey('k', 'v', null, 'prod-cw');
        const rejected = expect(done).rejects.toThrow(/cancel/i);
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));
        await rejected;
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('a wrong name keeps the confirm button disabled', async () => {
        const user = userEvent.setup();
        render(<ConfirmWriteHost />);
        void saveKey('k', 'v', null, 'prod-cw').catch(() => undefined);
        await user.type(
            await screen.findByLabelText(/connection name/i),
            'nope'
        );
        expect(
            screen.getByRole('button', { name: 'Confirm write' })
        ).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    it('does not ask for unguarded connections', async () => {
        render(<ConfirmWriteHost />);
        await saveKey('k', 'v', null, 'dev');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(fetchMock).toHaveBeenCalled();
    });
});
