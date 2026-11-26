import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { streamAiChat } from '@/services/aiChat';
import { runConsole } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { subscribeToasts } from '@/utils/toast';

jest.mock('@/pages/Keys/KeysPage', () => ({
    KeysPage: () => <div>KEYS PAGE</div>
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
    getAiModel: jest.fn().mockResolvedValue({
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        models: ['claude-sonnet-5-5'],
        keyLast4: '9F2c'
    }),
    listAiAccess: jest.fn().mockResolvedValue([]),
    runConsole: jest.fn(),
    // the line check never gets its list here
    getConsoleCommands: () => new Promise(() => {})
}));

const stream = jest.mocked(streamAiChat);
const run = jest.mocked(runConsole);
const initial = useAppStore.getState();

beforeEach(() => {
    localStorage.clear();
    useAppStore.setState(initial, true);
    stream.mockReset();
    stream.mockResolvedValue();
    run.mockReset();
});

async function open(path = '/console') {
    const user = userEvent.setup();
    render(
        <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
        </MemoryRouter>
    );
    await screen.findByRole('button', { name: /Open assistant/ });
    return user;
}

const editor = () =>
    screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: /redis commands/i
    });
const chat = () =>
    within(screen.getByRole('complementary', { name: 'Assistant' }));
const context = () => within(chat().getByLabelText('Context'));
const sent = (turn = 0) => stream.mock.calls[turn]?.[0].messages;
const click = (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(screen.getByRole('button', { name }));

const lineChip = (line: number, text: string) => ({
    kind: 'line',
    connectionId: 'local',
    line,
    text,
    tabId: 1,
    tabName: 'console-1.redis'
});

test('"Ask about this line" asks about the line under the cursor', async () => {
    const user = await open();
    await user.type(editor(), 'PING{Enter}HGETALL user:1{Enter}DBSIZE');
    editor().setSelectionRange(8, 8);

    await click(user, 'Ask about this line');

    expect(sent()).toEqual([
        {
            role: 'user',
            text: 'Explain this query',
            chips: [lineChip(2, 'HGETALL user:1')]
        }
    ]);
    expect(context().getByText('L2 HGETALL user:1')).toBeVisible();
    expect(run).not.toHaveBeenCalled();
});

test('"Ask about this line" says when there is no command there', async () => {
    const toasts: string[] = [];
    const stop = subscribeToasts((all) =>
        toasts.push(...all.map((t) => t.message))
    );
    const user = await open();
    await user.type(editor(), '# just a note');

    await click(user, 'Ask about this line');

    expect(toasts).toContain('No command on this line');
    expect(stream).not.toHaveBeenCalled();
    expect(
        screen.queryByRole('complementary', { name: 'Assistant' })
    ).not.toBeInTheDocument();
    stop();
});

test('"Ask about result" sends the result of that statement', async () => {
    run.mockResolvedValue([
        {
            line: 1,
            text: 'HGETALL user:1',
            kind: 'array',
            reply: ['name', 'Ada'],
            ms: 1
        }
    ]);
    const user = await open();
    await user.type(editor(), 'HGETALL user:1');
    await click(user, 'Run line');

    await user.click(
        await screen.findByRole('button', { name: 'Ask about result' })
    );

    expect(sent()).toEqual([
        {
            role: 'user',
            text: 'Explain this result',
            chips: [
                {
                    kind: 'result',
                    connectionId: 'local',
                    line: 1,
                    text: 'HGETALL user:1',
                    resultKind: 'array',
                    reply: ['name', 'Ada']
                }
            ]
        }
    ]);
    expect(context().getByText('Result of L1 HGETALL user:1')).toBeVisible();

    // A question about a line takes the result's place.
    await click(user, 'Ask about this line');
    expect(sent(1)?.at(-1)).toMatchObject({
        chips: [lineChip(1, 'HGETALL user:1')]
    });
});

const openChat = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /Open assistant/ }));

const addLine = { name: '+ Current line' };

test('"+ Current line" attaches the line under the cursor', async () => {
    const user = await open();
    await user.type(editor(), 'PING{Enter}DBSIZE{Enter}INFO');
    editor().setSelectionRange(6, 6);
    fireEvent.keyUp(editor(), { key: 'ArrowUp' });
    await openChat(user);

    await user.click(chat().getByRole('button', addLine));

    expect(context().getByText('L2 DBSIZE')).toBeVisible();
    expect(stream).not.toHaveBeenCalled();
    expect(
        within(chat().getByRole('group', { name: 'Suggested prompts' }))
            .getAllByRole('button')
            .map((b) => b.textContent)
    ).toEqual([
        'Explain this query',
        'Is this safe to run on production?',
        'Make it faster'
    ]);

    await user.click(
        chat().getByRole('button', { name: 'Remove L2 DBSIZE from context' })
    );
    expect(context().queryByText('L2 DBSIZE')).not.toBeInTheDocument();
});

test('"+ Current line" follows the open tab', async () => {
    const user = await open();
    await user.type(editor(), 'PING');
    await click(user, 'New console');
    await user.type(editor(), 'DBSIZE');
    await openChat(user);
    await user.click(screen.getByRole('tab', { name: 'console-1.redis' }));

    await user.click(chat().getByRole('button', addLine));

    expect(context().getByText('L1 PING')).toBeVisible();
});

test('"+ Current line" is only offered in the Console', async () => {
    const user = await open('/keys');
    await openChat(user);

    expect(chat().queryByRole('button', addLine)).not.toBeInTheDocument();
});

test('"Explain the line at my cursor" sends that line', async () => {
    const user = await open();
    await user.type(editor(), 'PING');
    await openChat(user);

    await user.click(
        chat().getByRole('button', { name: 'Explain the line at my cursor' })
    );

    expect(sent()).toEqual([
        {
            role: 'user',
            text: 'Explain the line at my cursor',
            chips: [lineChip(1, 'PING')]
        }
    ]);
});

/** The assistant answers every question with a code block. */
const answerWith = (code: string) =>
    stream.mockImplementation(async (_, { onEvent }) => {
        onEvent({ type: 'text', text: '```\n' + code + '\n```' });
    });

const consoleTab = (name: string) => screen.getByRole('tab', { name });

test('"Replace line N" and "Open in console" edit the tab and run nothing', async () => {
    answerWith('# cheaper\nHGET user:1 name\nTTL user:1');
    const user = await open();
    await user.type(editor(), 'PING{Enter}HGETALL user:1{Enter}DBSIZE');
    editor().setSelectionRange(8, 8);
    await click(user, 'Ask about this line');

    // Another tab is open by the time the answer is used.
    await click(user, 'New console');
    await user.click(
        await chat().findByRole('button', {
            name: 'Replace line 2 in console-1.redis'
        })
    );
    expect(consoleTab('console-1.redis')).toHaveAttribute(
        'aria-selected',
        'true'
    );
    expect(editor().value).toBe('PING\nHGET user:1 name\nDBSIZE');

    await user.click(chat().getByRole('button', { name: 'Open in console' }));
    expect(editor().value).toBe(
        'PING\nHGET user:1 name\nDBSIZE\n\n# cheaper\nHGET user:1 name\nTTL user:1'
    );
    expect(run).not.toHaveBeenCalled();
});

test('"Open in console" goes to the Console from another page', async () => {
    answerWith('SCAN 0 COUNT 100');
    const user = await open('/keys');
    await openChat(user);
    await user.type(
        chat().getByRole('textbox', { name: /message/i }),
        'How do I scan?{Enter}'
    );
    const openIn = await chat().findByRole('button', {
        name: 'Open in console'
    });
    // No line was attached, so there is none to replace.
    expect(
        chat().queryByRole('button', { name: /Replace line/ })
    ).not.toBeInTheDocument();

    await user.click(openIn);

    expect(editor().value).toBe('SCAN 0 COUNT 100');
    expect(run).not.toHaveBeenCalled();
});

test('"Replace line N" says when the line is gone, and goes with its tab', async () => {
    const toasts: string[] = [];
    const stop = subscribeToasts((all) =>
        toasts.push(...all.map((t) => t.message))
    );
    answerWith('TTL k');
    const user = await open();
    await user.type(editor(), 'PING{Enter}GET k');
    await click(user, 'Ask about this line');
    const replace = { name: 'Replace line 2 in console-1.redis' };

    await user.clear(editor());
    await user.click(await chat().findByRole('button', replace));
    expect(toasts).toContain('Line 2 is no longer there');
    expect(editor().value).toBe('');

    await click(user, 'New console');
    await click(user, 'Close console-1.redis');
    expect(chat().queryByRole('button', replace)).not.toBeInTheDocument();
    stop();
});
