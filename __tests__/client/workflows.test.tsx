import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { useAppStore } from '@/store/useAppStore';
import * as api from '@/services/apiService';
import type { WorkflowPlugin } from '@/types/workflows';

jest.mock('@/pages/Home/Home', () => ({ Home: () => <div>KEYS PAGE</div> }));
jest.mock('@/pages/Settings/SettingsApp', () => ({
    SettingsApp: () => <div>CONNECTIONS</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS</div>
}));
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest.fn(),
    getKeyCount: jest.fn().mockResolvedValue({ count: 1 }),
    getServerStatus: jest.fn().mockResolvedValue({ version: '7', pingMs: 1 }),
    getWorkflows: jest.fn(),
    getWorkflowHistory: jest.fn(),
    planWorkflow: jest.fn(),
    runWorkflow: jest.fn()
}));

const mocked = api as jest.Mocked<typeof api>;

const plugins: WorkflowPlugin[] = [
    {
        id: 'examples',
        name: 'Examples',
        actions: [
            {
                id: 'set-marker',
                fullId: 'examples.set-marker',
                title: 'Set marker key',
                writes: true,
                inputs: [
                    {
                        name: 'id',
                        label: 'Marker id',
                        type: 'int',
                        required: true
                    },
                    { name: 'token', label: 'Token', type: 'uuid' }
                ]
            }
        ]
    }
];

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
        </MemoryRouter>
    );
}

const conn = (readOnly: boolean) => ({
    id: 'c1',
    host: 'h',
    port: 1,
    tls: false,
    cluster: false,
    tier: 'production' as const,
    readOnly
});

function connect(readOnly: boolean) {
    mocked.loadEnvironments.mockResolvedValue([conn(readOnly)]);
    useAppStore.setState({
        connections: [conn(readOnly)],
        currentEnvironment: 'c1',
        isLoading: false
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mocked.getWorkflows.mockResolvedValue(plugins);
    mocked.getWorkflowHistory.mockResolvedValue([]);
    connect(false);
});

describe('sidebar Workflows group', () => {
    it('lists plugin actions linking to /workflows/:actionId', async () => {
        renderAt('/keys');
        const link = await screen.findByRole('link', {
            name: 'Set marker key'
        });
        expect(link).toHaveAttribute('href', '/workflows/examples.set-marker');
    });

    it('is hidden when no plugin defines actions', async () => {
        mocked.getWorkflows.mockResolvedValue([]);
        renderAt('/keys');
        await screen.findByText('KEYS PAGE');
        await waitFor(() => expect(mocked.getWorkflows).toHaveBeenCalled());
        expect(screen.queryByText('Workflows')).not.toBeInTheDocument();
    });
});

describe('workflow page', () => {
    it('validates before calling the server', async () => {
        renderAt('/workflows/examples.set-marker');
        await userEvent.click(
            await screen.findByRole('button', { name: 'Dry run' })
        );
        expect(await screen.findByText('Required')).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText(/Marker id/), 'abc');
        await userEvent.type(screen.getByLabelText(/Token/), 'nope');
        await userEvent.click(screen.getByRole('button', { name: 'Dry run' }));
        expect(screen.getByText('Must be a whole number')).toBeInTheDocument();
        expect(screen.getByText('Must be a valid UUID')).toBeInTheDocument();
        expect(mocked.planWorkflow).not.toHaveBeenCalled();
    });

    it('dry-runs, runs, and refreshes history', async () => {
        mocked.planWorkflow.mockResolvedValue({ text: 'Would SET x' });
        mocked.runWorkflow.mockResolvedValue({ ok: true, text: 'Set x' });
        renderAt('/workflows/examples.set-marker');
        await userEvent.type(await screen.findByLabelText(/Marker id/), '7');

        await userEvent.click(screen.getByRole('button', { name: 'Dry run' }));
        expect(await screen.findByText('Would SET x')).toBeInTheDocument();
        expect(mocked.planWorkflow).toHaveBeenCalledWith(
            'examples.set-marker',
            'c1',
            { id: '7', token: '' }
        );

        mocked.getWorkflowHistory.mockResolvedValue([
            {
                id: 1,
                connection: 'c1',
                tier: 'production',
                inputs: { id: 7 },
                ok: true,
                text: 'Set x',
                at: Date.now()
            }
        ]);
        await userEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByTestId('history-row')).toHaveTextContent(
            'c1'
        );
        expect(mocked.runWorkflow).toHaveBeenCalledWith(
            'examples.set-marker',
            'c1',
            { id: '7', token: '' },
            true
        );
    });

    it('blocks a writing workflow on a read-only connection', async () => {
        connect(true);
        renderAt('/workflows/examples.set-marker');
        expect(
            await screen.findByRole('button', { name: 'Run' })
        ).toBeDisabled();
        expect(screen.getByText(/Blocked: .*read-only/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Dry run' })).toBeEnabled();
    });

    it('shows server errors inline', async () => {
        mocked.runWorkflow.mockRejectedValue(new Error('boom'));
        renderAt('/workflows/examples.set-marker');
        await userEvent.type(await screen.findByLabelText(/Marker id/), '7');
        await userEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByText('boom')).toBeInTheDocument();
    });
});
