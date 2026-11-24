import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AiPage } from '@/pages/Ai/AiPage';
import * as api from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import type { RedisConnection } from '@/types';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const renderPage = () =>
    render(
        <MemoryRouter>
            <AiPage />
        </MemoryRouter>
    );

const setDesktop = (on: boolean) => {
    Object.defineProperty(window, 'desktop', {
        value: on ? { setTitleBarColors: jest.fn() } : undefined,
        configurable: true,
        writable: true
    });
};

beforeEach(() => {
    jest.resetAllMocks();
    setDesktop(false);
    useAppStore.setState({
        connections: [{ id: 'prod' }, { id: 'dev' }] as RedisConnection[]
    });
    mocked.getAiActivityLogging.mockResolvedValue(true);
    mocked.listAiAccess.mockResolvedValue([]);
    mocked.listAiClients.mockResolvedValue({
        command: '/bin/redis-deck --mcp',
        clients: [
            {
                id: 'claude-code',
                name: 'Claude Code',
                configPath: '/h/.claude.json',
                status: 'not-installed'
            },
            {
                id: 'cursor',
                name: 'Cursor',
                configPath: '/h/cursor.json',
                status: 'installed'
            }
        ]
    });
    mocked.listAiActivity.mockResolvedValue({
        total: 1,
        entries: [
            {
                id: 1,
                time: Date.now(),
                client: 'claude-code',
                connectionId: 'prod',
                operation: 'set_key',
                target: 'user:1',
                result: 'denied',
                error: 'The user denied set_key'
            }
        ]
    });
});

afterAll(() => setDesktop(false));

test('outside Desktop: log and switch show, AI clients section does not', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findAllByTestId('ai-activity-row')).toHaveLength(1);
    expect(screen.getByText('The user denied set_key')).toBeInTheDocument();
    expect(screen.queryByText('MCP server')).not.toBeInTheDocument();
    expect(mocked.listAiClients).not.toHaveBeenCalled();

    const toggle = await screen.findByLabelText('Log AI operations');
    mocked.setAiActivityLogging.mockResolvedValue(false);
    await user.click(toggle);
    expect(mocked.setAiActivityLogging).toHaveBeenCalledWith(false);

    await user.selectOptions(screen.getByLabelText('Connection'), 'prod');
    await waitFor(() =>
        expect(mocked.listAiActivity).toHaveBeenLastCalledWith({
            connectionId: 'prod',
            limit: 50,
            offset: 0
        })
    );
});

test('Desktop: MCP server card shows the command and copies it', async () => {
    setDesktop(true);
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
    renderPage();

    expect(await screen.findByText('/bin/redis-deck --mcp')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('/bin/redis-deck --mcp');
});

test('Desktop: client rows install and open Manual setup', async () => {
    setDesktop(true);
    mocked.installAiClient.mockResolvedValue(undefined);
    mocked.getAiClientSnippet.mockResolvedValue({
        path: '/h/.claude.json',
        text: '{"redis-deck":{}}'
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findAllByTestId('ai-client-row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(mocked.installAiClient).toHaveBeenCalledWith('claude-code');

    await user.click(
        screen.getAllByRole('button', { name: 'Manual setup' })[0]
    );
    expect(await screen.findByText('{"redis-deck":{}}')).toBeInTheDocument();
});
