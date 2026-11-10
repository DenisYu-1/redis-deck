import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/pages/Settings/SettingsApp', () => ({
    SettingsApp: () => <div>CONNECTIONS PAGE</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS PAGE</div>
}));
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest.fn().mockResolvedValue([
        { id: 'local', host: 'h1', port: 6379, tls: false, cluster: false },
        { id: 'prod', host: 'h2', port: 6380, tls: true, cluster: false }
    ]),
    getKeyCount: jest.fn().mockResolvedValue({ count: 42 }),
    getServerStatus: jest.fn().mockResolvedValue({ version: '7.2.0', pingMs: 3 })
}));

function Path() {
    return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
            <Path />
        </MemoryRouter>
    );
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useAppStore.setState({
        connections: [],
        currentEnvironment: null,
        isLoading: false
    });
});

describe('routes', () => {
    it('redirects / to /keys', async () => {
        renderAt('/');
        expect(await screen.findByText('KEYS PAGE')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/keys');
    });

    it('redirects /settings to /connections', async () => {
        renderAt('/settings');
        expect(await screen.findByText('CONNECTIONS PAGE')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/connections');
    });

    it.each(['/stats', '/stats/memory'])('renders statistics at %s', async (p) => {
        renderAt(p);
        expect(await screen.findByText('STATS PAGE')).toBeInTheDocument();
    });
});

describe('sidebar', () => {
    it('shows the current connection and switches via the menu', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        const switcher = await screen.findByRole('button', { name: /local/ });
        await user.click(switcher);
        await user.click(screen.getByRole('menuitem', { name: /prod/ }));
        expect(useAppStore.getState().currentEnvironment).toBe('prod');
        expect(screen.getByRole('button', { name: /prod/ })).toBeInTheDocument();
    });

    it('offers Manage connections in the switcher menu', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        await user.click(await screen.findByRole('button', { name: /local/ }));
        await user.click(
            screen.getByRole('menuitem', { name: /manage connections/i })
        );
        expect(await screen.findByText('CONNECTIONS PAGE')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/connections');
    });

    it('navigates with Keys and Statistics links', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        await user.click(await screen.findByRole('link', { name: /statistics/i }));
        expect(await screen.findByText('STATS PAGE')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/stats');
    });

    it('theme toggle switches data-theme and persists', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        await screen.findByText('KEYS PAGE');
        await user.click(screen.getByRole('radio', { name: /dark/i }));
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(localStorage.getItem('redisdeck-theme')).toBe('dark');
        await user.click(screen.getByRole('radio', { name: /light/i }));
        expect(document.documentElement.dataset.theme).toBe('light');
        await user.click(screen.getByRole('radio', { name: /auto/i }));
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });
});

describe('toast', () => {
    it('shows toasts raised through showToast', async () => {
        renderAt('/keys');
        await screen.findByText('KEYS PAGE');
        act(() => showToast('Saved it', 'success'));
        await waitFor(() =>
            expect(screen.getByText('Saved it')).toBeInTheDocument()
        );
    });
});
