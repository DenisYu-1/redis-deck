import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { streamAiChat, type ChatEvent } from '@/services/aiChat';
import { loadEnvironments } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS PAGE</div>
}));
jest.mock('@/services/aiChat');
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest
        .fn()
        .mockResolvedValue([
            { id: 'local', host: 'h1', port: 6379, tier: 'local' }
        ]),
    getWorkflows: jest.fn().mockResolvedValue([]),
    getKeyCount: jest.fn().mockResolvedValue({ count: 1 }),
    getServerStatus: jest.fn().mockResolvedValue({}),
    listAiAccess: jest.fn().mockResolvedValue([]),
    getAiModel: jest.fn().mockResolvedValue({
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        models: ['claude-sonnet-5-5'],
        keyLast4: '9F2c'
    })
}));

const stream = jest.mocked(streamAiChat);

test('sends a question, shows the streamed answer and its tool row, and keeps the chat across pages', async () => {
    const user = userEvent.setup();
    let emit: (event: ChatEvent) => void = () => {};
    let finish: () => void = () => {};
    stream.mockImplementation((_, options) => {
        emit = options.onEvent;
        return new Promise<void>((resolve) => (finish = resolve));
    });
    render(
        <MemoryRouter initialEntries={['/keys']}>
            <AppRoutes />
        </MemoryRouter>
    );

    await user.click(
        await screen.findByRole('button', { name: /Open assistant/ })
    );
    const panel = screen.getByRole('complementary', { name: 'Assistant' });
    const chat = within(panel);
    expect(chat.getByText('Ask about local')).toBeVisible();
    const model = await chat.findByRole('link', {
        name: 'Anthropic · claude-sonnet-5-5'
    });
    expect(model).toHaveAttribute('href', '/ai');
    expect(chat.queryByText('No model is set up yet')).not.toBeInTheDocument();

    const input = chat.getByRole('textbox', { name: /message/i });
    expect(input).toHaveFocus();
    await user.type(input, 'What is user:1?{Enter}');

    expect(stream).toHaveBeenCalledWith(
        {
            chatId: expect.any(String),
            connectionId: 'local',
            messages: [{ role: 'user', text: 'What is user:1?' }]
        },
        expect.anything()
    );
    expect(chat.getByRole('button', { name: 'Send' })).toBeDisabled();
    // One turn at a time: Enter while answering sends nothing.
    await user.type(input, 'again{Enter}');
    expect(stream).toHaveBeenCalledTimes(1);

    const call = {
        type: 'tool',
        id: 'call-1',
        tool: 'get_key',
        args: { connectionId: 'local', key: 'user:1' }
    } as const;
    act(() => {
        emit({ type: 'text', text: 'Looking ' });
        emit({ type: 'text', text: 'it up.' });
        emit({ ...call, status: 'running' });
    });
    expect(chat.getByText('Looking it up.')).toBeVisible();
    expect(chat.getByRole('img', { name: 'running' })).toBeInTheDocument();

    act(() => {
        emit({
            ...call,
            status: 'ok',
            ms: 7,
            response: '{"type":"hash"}'
        });
        emit({
            type: 'text',
            text: 'It is a **hash**. <img src=x>\n\n```\nHGETALL user:1\n```'
        });
        emit({ type: 'done' });
        finish();
    });

    const row = chat.getByText('get_key').closest('details') as HTMLElement;
    expect(row).not.toHaveAttribute('open');
    expect(row.querySelector('summary')).toHaveTextContent(
        'okget_keyuser:17 ms'
    );
    expect(row.querySelector('pre')).toHaveTextContent('"type": "hash"');
    expect(chat.getByText('hash').tagName).toBe('STRONG');
    // No raw HTML: the tag is text.
    expect(panel.querySelector('img')).toBeNull();
    expect(chat.getByText(/<img src=x>/)).toBeVisible();

    await user.click(chat.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe('HGETALL user:1');

    // History survives a page change; Esc closes and hands focus back.
    await user.click(screen.getByRole('link', { name: /statistics/i }));
    expect(await screen.findByText('STATS PAGE')).toBeInTheDocument();
    expect(chat.getByText('What is user:1?')).toBeVisible();

    // The next turn carries the whole transcript.
    await waitFor(() =>
        expect(chat.getByRole('button', { name: 'Send' })).toBeEnabled()
    );
    stream.mockResolvedValueOnce();
    await user.clear(input);
    await user.type(input, 'And its TTL?{Enter}');
    expect(stream.mock.calls[1]?.[0].messages).toEqual([
        { role: 'user', text: 'What is user:1?' },
        {
            role: 'assistant',
            text: 'Looking it up.\n\nIt is a **hash**. <img src=x>\n\n```\nHGETALL user:1\n```'
        },
        { role: 'user', text: 'And its TTL?' }
    ]);

    await user.click(input);
    await user.keyboard('{Escape}');
    expect(
        screen.queryByRole('complementary', { name: 'Assistant' })
    ).not.toBeInTheDocument();
    const fab = screen.getByRole('button', { name: /Open assistant/ });
    expect(fab).toHaveFocus();

    // Reopened, then New chat forgets everything.
    await user.click(fab);
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.queryByText('What is user:1?')).not.toBeInTheDocument();
    expect(useAppStore.getState().chat.messages).toEqual([]);
});

test('there is no assistant on Welcome, which has no Connection yet', async () => {
    useAppStore.setState({ connections: [], currentEnvironment: null });
    jest.mocked(loadEnvironments).mockResolvedValueOnce([]);
    render(
        <MemoryRouter initialEntries={['/keys']}>
            <AppRoutes />
        </MemoryRouter>
    );

    expect(await screen.findByRole('heading')).toBeInTheDocument();
    await waitFor(() => expect(loadEnvironments).toHaveBeenCalled());
    await act(async () => {});
    expect(
        screen.queryByRole('button', { name: /Open assistant/ })
    ).not.toBeInTheDocument();
});
