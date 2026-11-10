import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { useAppStore } from '@/store/useAppStore';
import { saveKey, deleteKey } from '@/services/apiService';
import { subscribeToasts } from '@/utils/toast';
import type { RedisConnection } from '@/types';

jest.mock('@/pages/Home/Home', () => ({ Home: () => <div>KEYS PAGE</div> }));
jest.mock('@/pages/Settings/SettingsApp', () => ({
    SettingsApp: () => <div>CONNECTIONS PAGE</div>
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

    it('sends X-Confirm-Connection once the connection name is typed', async () => {
        const prompt = jest.spyOn(window, 'prompt').mockReturnValue('prod-cw');
        await saveKey('k', 'v', null, 'prod-cw');
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(
            (init.headers as Record<string, string>)['X-Confirm-Connection']
        ).toBe('prod-cw');
        prompt.mockRestore();
    });

    it('does not send the write when the typed name is wrong', async () => {
        const prompt = jest.spyOn(window, 'prompt').mockReturnValue('nope');
        await expect(saveKey('k', 'v', null, 'prod-cw')).rejects.toThrow(
            /cancel/i
        );
        expect(fetchMock).not.toHaveBeenCalled();
        prompt.mockRestore();
    });

    it('does not prompt for unguarded connections', async () => {
        const prompt = jest.spyOn(window, 'prompt');
        await saveKey('k', 'v', null, 'dev');
        expect(prompt).not.toHaveBeenCalled();
        prompt.mockRestore();
    });
});
