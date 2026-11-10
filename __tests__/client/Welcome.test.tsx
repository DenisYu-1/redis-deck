import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { useAppStore } from '@/store/useAppStore';
import {
    addConnection,
    loadEnvironments,
    testConnectionDraft
} from '@/services/apiService';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/pages/Connections/ConnectionsPage', () => ({
    ConnectionsPage: () => <div>CONNECTIONS PAGE</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS PAGE</div>
}));
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest.fn(),
    addConnection: jest.fn().mockResolvedValue(undefined),
    testConnectionDraft: jest.fn(),
    getKeyCount: jest.fn().mockResolvedValue({ count: 0 }),
    getServerStatus: jest.fn().mockResolvedValue({ version: '7', pingMs: 1 })
}));

const load = loadEnvironments as jest.Mock;
const add = addConnection as jest.Mock;
const testConn = testConnectionDraft as jest.Mock;

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
    jest.clearAllMocks();
    load.mockResolvedValue([]);
    add.mockResolvedValue(undefined);
    useAppStore.setState({
        connections: [],
        currentEnvironment: null,
        isLoading: false
    });
});

describe('Welcome', () => {
    it.each(['/keys', '/stats', '/stats/memory', '/connections'])(
        'replaces %s when there are no connections',
        async (p) => {
            renderAt(p);
            expect(
                await screen.findByRole('heading', {
                    name: /connect to a redis server/i
                })
            ).toBeInTheDocument();
            expect(screen.queryByText(/PAGE$/)).not.toBeInTheDocument();
        }
    );

    it('does not show Welcome when connections exist', async () => {
        load.mockResolvedValue([
            { id: 'local', host: 'h', port: 6379, tls: false, cluster: false }
        ]);
        renderAt('/keys');
        expect(await screen.findByText('KEYS PAGE')).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', {
                name: /connect to a redis server/i
            })
        ).not.toBeInTheDocument();
    });

    it('fills the fields from a pasted URI', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        await user.click(await screen.findByLabelText(/connection uri/i));
        await user.paste('rediss://bob:pw@cache.example.com:6380/2');
        expect(screen.getByLabelText('Host')).toHaveValue('cache.example.com');
        expect(screen.getByLabelText('Port')).toHaveValue('6380');
        expect(screen.getByLabelText('Name')).toHaveValue('cache');
    });

    it('validates name and host before saving', async () => {
        const user = userEvent.setup();
        renderAt('/keys');
        await user.click(await screen.findByRole('button', { name: /^save/i }));
        expect(
            screen.getByText('Give the connection a name')
        ).toBeInTheDocument();
        expect(screen.getByText('Enter a host')).toBeInTheDocument();
        expect(add).not.toHaveBeenCalled();
    });

    it('tests the connection and shows the result', async () => {
        testConn.mockResolvedValue({ success: true, message: 'PONG ok' });
        const user = userEvent.setup();
        renderAt('/keys');
        await user.type(await screen.findByLabelText('Host'), 'localhost');
        await user.click(screen.getByRole('button', { name: /^test/i }));
        expect(await screen.findByText('PONG ok')).toBeInTheDocument();
        expect(testConn).toHaveBeenCalledWith(
            expect.objectContaining({ host: 'localhost', id: '' })
        );
    });

    it('saves, selects the connection and lands on /keys', async () => {
        const saved = {
            id: 'mine',
            host: 'localhost',
            port: 6379,
            tls: false,
            cluster: false
        };
        add.mockImplementation(() => {
            load.mockResolvedValue([saved]);
            return Promise.resolve();
        });
        const user = userEvent.setup();
        renderAt('/connections');
        await user.type(await screen.findByLabelText('Name'), 'mine');
        await user.type(screen.getByLabelText('Host'), 'localhost');
        await user.click(screen.getByRole('button', { name: /^save/i }));
        expect(await screen.findByText('KEYS PAGE')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/keys');
        expect(add).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'mine',
                host: 'localhost',
                port: 6379
            })
        );
        expect(useAppStore.getState().currentEnvironment).toBe('mine');
    });
});
