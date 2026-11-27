import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { streamAiChat } from '@/services/aiChat';
import { listAiAccess, setAiAccess } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/pages/Console/ConsolePage', () => ({
    ConsolePage: () => <div>CONSOLE PAGE</div>
}));
// Of the AI page only the grid matters here.
jest.mock('@/pages/Ai/AiPage', () => {
    const { AiAccessGrid } = jest.requireActual('@/pages/Ai/AiAccessGrid');
    return { AiPage: () => <AiAccessGrid /> };
});

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
}));
jest.mock('@/pages/Statistics/StatisticsApp', () => ({
    StatisticsApp: () => <div>STATS PAGE</div>
}));
jest.mock('@/services/aiChat');
jest.mock('@/services/apiService', () => ({
    loadEnvironments: jest.fn().mockResolvedValue([
        { id: 'local', host: 'h1', port: 6379, tier: 'local' },
        { id: 'other', host: 'h2', port: 6379, tier: 'local' }
    ]),
    getWorkflows: jest.fn().mockResolvedValue([]),
    getKeyCount: jest.fn().mockResolvedValue({ count: 1 }),
    getServerStatus: jest.fn().mockResolvedValue({}),
    getAiModel: jest.fn().mockResolvedValue({
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        models: ['claude-sonnet-5-5'],
        keyLast4: '9F2c'
    }),
    listAiAccess: jest.fn().mockResolvedValue([]),
    setAiAccess: jest.fn()
}));

const stream = jest.mocked(streamAiChat);
const initial = useAppStore.getState();

beforeEach(() => {
    useAppStore.setState(initial, true);
    stream.mockReset();
    stream.mockResolvedValue();
});

async function openChat(path = '/keys') {
    const user = userEvent.setup();
    render(
        <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
        </MemoryRouter>
    );
    await user.click(
        await screen.findByRole('button', { name: /Open assistant/ })
    );
    const chat = within(
        screen.getByRole('complementary', { name: 'Assistant' })
    );
    return { user, chat };
}

const select = (key: string) =>
    act(() => {
        useAppStore.getState().setSelectedKey(key);
        useAppStore.getState().setKeyDetails({
            key,
            type: 'string',
            ttl: -1,
            value: 'TOP-SECRET'
        } as never);
    });

const sentMessages = (turn = 0) => stream.mock.calls[turn]?.[0].messages;

test('the selected Key is attached by name, shown on the bubble, and can be removed', async () => {
    const { user, chat } = await openChat();
    const add = { name: '+ Selected key' };
    expect(chat.queryByRole('button', add)).not.toBeInTheDocument();

    select('user:1');
    await user.click(chat.getByRole('button', add));
    // Already attached: nothing more to add.
    expect(chat.queryByRole('button', add)).not.toBeInTheDocument();
    const context = within(chat.getByLabelText('Context'));
    expect(context.getByText('user:1')).toBeVisible();

    const input = chat.getByRole('textbox', { name: /message/i });
    await user.type(input, 'What is it?{Enter}');

    const chip = { kind: 'key', connectionId: 'local', key: 'user:1' };
    expect(sentMessages()).toEqual([
        { role: 'user', text: 'What is it?', chips: [chip] }
    ]);
    expect(JSON.stringify(stream.mock.calls)).not.toContain('TOP-SECRET');
    const log = within(chat.getByRole('log'));
    expect(log.getByText('user:1')).toBeVisible();

    // Another Key replaces the chip of the same kind.
    select('user:2');
    await user.click(chat.getByRole('button', add));
    expect(context.queryByText('user:1')).not.toBeInTheDocument();
    expect(context.getByText('user:2')).toBeVisible();

    await user.click(
        chat.getByRole('button', { name: 'Remove user:2 from context' })
    );
    expect(context.queryByText('user:2')).not.toBeInTheDocument();
    await user.type(input, 'And now?{Enter}');
    const next = sentMessages(1);
    // The earlier message keeps what it was sent with; the new one has none.
    expect(next?.[0]).toEqual({
        role: 'user',
        text: 'What is it?',
        chips: [chip]
    });
    expect(next?.at(-1)).toEqual({ role: 'user', text: 'And now?' });
});

test('"+ Selected key" is only offered on Keys, and a chip does not outlive its Connection', async () => {
    const { user, chat } = await openChat('/stats');
    select('user:1');
    expect(
        chat.queryByRole('button', { name: '+ Selected key' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^keys/i }));
    await user.click(chat.getByRole('button', { name: '+ Selected key' }));
    act(() => useAppStore.getState().setCurrentEnvironment('other'));
    expect(chat.queryByText('user:1')).not.toBeInTheDocument();
});

const prompts = (chat: ReturnType<typeof within>) =>
    within(chat.getByRole('group', { name: 'Suggested prompts' }))
        .getAllByRole('button')
        .map((b) => b.textContent);

test('suggested prompts follow the page and send on click', async () => {
    const { user, chat } = await openChat('/stats');
    expect(prompts(chat)).toEqual([
        'Why is RSS higher than used memory?',
        'Is anything wrong with this server?',
        'Which queues are backing up?'
    ]);

    await user.click(screen.getByRole('link', { name: /^console/i }));
    expect(prompts(chat)).toEqual([
        'Explain the line at my cursor',
        'Which keys have no TTL?',
        'What are the biggest keys?'
    ]);

    await user.click(screen.getByRole('link', { name: /^keys/i }));
    expect(prompts(chat)).toEqual([
        'Explain a key',
        'Which keys have no TTL?',
        'What are the biggest keys?',
        'Which queues are backing up?'
    ]);

    await user.click(
        chat.getByRole('button', { name: 'What are the biggest keys?' })
    );
    expect(sentMessages()).toEqual([
        { role: 'user', text: 'What are the biggest keys?' }
    ]);
    expect(
        chat.queryByRole('group', { name: 'Suggested prompts' })
    ).not.toBeInTheDocument();
});

test('a prompt about the selected Key sends its chip', async () => {
    const { user, chat } = await openChat();
    select('user:1');
    await user.click(
        chat.getByRole('button', { name: 'Explain the selected key' })
    );

    expect(sentMessages()).toEqual([
        {
            role: 'user',
            text: 'Explain the selected key',
            chips: [{ kind: 'key', connectionId: 'local', key: 'user:1' }]
        }
    ]);
});

test('with a Key attached, the prompts are about it', async () => {
    const { user, chat } = await openChat();
    select('user:1');
    await user.click(chat.getByRole('button', { name: '+ Selected key' }));

    expect(prompts(chat)).toEqual([
        'Explain this key',
        'Why does it have this TTL?',
        'Which keys have no TTL?'
    ]);
});

test('the Connection chip says "values hidden" while See values is off', async () => {
    const row = {
        tier: 'local' as const,
        readOnly: false,
        keys: true,
        values: true,
        write: true,
        workflows: false,
        ask: true
    };
    jest.mocked(listAiAccess).mockResolvedValue([
        { ...row, id: 'local' },
        { ...row, id: 'other' }
    ]);
    jest.mocked(setAiAccess).mockResolvedValue({ ...row, values: false });
    const { user, chat } = await openChat('/ai');
    const context = within(chat.getByLabelText('Context'));
    const seeValues = await screen.findByRole('checkbox', {
        name: 'See values for local'
    });
    expect(context.queryByText('values hidden')).not.toBeInTheDocument();

    // Turned off in the grid while the chat is open.
    await user.click(seeValues);
    expect(await context.findByText('values hidden')).toBeVisible();

    // It is the current Connection's setting.
    act(() => useAppStore.getState().setCurrentEnvironment('other'));
    await waitFor(() =>
        expect(context.queryByText('values hidden')).not.toBeInTheDocument()
    );
});
