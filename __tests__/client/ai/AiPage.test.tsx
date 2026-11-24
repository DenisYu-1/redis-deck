import {
    cleanup,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
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
    mocked.listAiActivityClients.mockResolvedValue([]);
    mocked.listAiTools.mockResolvedValue([]);
    mocked.getAiHiddenFields.mockResolvedValue(['password']);
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
                error: 'The user denied set_key',
                args: '{"connectionId":"prod","key":"user:1"}',
                response: null,
                durationMs: 12
            }
        ]
    });
});

afterAll(() => setDesktop(false));

test('outside Desktop: log and switch show, AI clients section does not', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findAllByTestId('ai-activity-row')).toHaveLength(1);
    expect(screen.getByText(/The user denied set_key/)).toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
    await user.click(screen.getByTestId('ai-activity-row'));
    expect(screen.getByTestId('ai-activity-detail')).toHaveTextContent(
        '"key": "user:1"'
    );
    expect(screen.queryByText('MCP server')).not.toBeInTheDocument();
    expect(mocked.listAiClients).not.toHaveBeenCalled();

    const toggle = await screen.findByLabelText('Log AI operations');
    mocked.setAiActivityLogging.mockResolvedValue(false);
    await user.click(toggle);
    expect(mocked.setAiActivityLogging).toHaveBeenCalledWith(false);
});

test('log card: filters, Show more, Clear and Logging off marker', async () => {
    const user = userEvent.setup();
    mocked.listAiActivityClients.mockResolvedValue([
        { client: 'Cursor', lastCallAt: Date.now() }
    ]);
    mocked.clearAiActivity.mockResolvedValue(undefined);
    renderPage();
    await screen.findAllByTestId('ai-activity-row');
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('1 calls · 0 blocked · 0 errors')).toBeVisible();

    await user.type(screen.getByLabelText('Filter calls'), 'user');
    await user.click(screen.getByRole('button', { name: 'Denied' }));
    await user.selectOptions(screen.getByLabelText('Client'), 'Cursor');
    await waitFor(() =>
        expect(mocked.listAiActivity).toHaveBeenLastCalledWith({
            q: 'user',
            status: 'denied',
            client: 'Cursor',
            limit: 25,
            offset: 0
        })
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Clear'
        })
    );
    expect(mocked.clearAiActivity).toHaveBeenCalled();

    mocked.getAiActivityLogging.mockResolvedValue(false);
});

test('log card: Show 25 more raises the limit; off switch reads Logging off', async () => {
    const user = userEvent.setup();
    mocked.getAiActivityLogging.mockResolvedValue(false);
    const base = (await mocked.listAiActivity()).entries[0];
    mocked.listAiActivity.mockResolvedValue({ total: 40, entries: [base] });
    renderPage();

    expect(await screen.findByText('Logging off')).toBeInTheDocument();
    await user.click(
        await screen.findByRole('button', { name: 'Show 25 more' })
    );
    await waitFor(() =>
        expect(mocked.listAiActivity).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: 50 })
        )
    );
});

test('Desktop: Connected clients lists recent clients, or says none yet', async () => {
    setDesktop(true);
    renderPage();
    expect(await screen.findByText('No AI clients yet.')).toBeVisible();
    cleanup();

    mocked.listAiActivityClients.mockResolvedValue([
        { client: 'Cursor', lastCallAt: Date.now() - 5 * 60000 }
    ]);
    renderPage();
    expect(await screen.findByText('last call 5 min ago')).toBeVisible();
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
