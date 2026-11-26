import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsolePage } from '@/pages/Console/ConsolePage';
import { runConsole, type ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/services/apiService', () => ({
    runConsole: jest.fn(),
    // the line check never gets its list here
    getConsoleCommands: () => new Promise(() => {})
}));
const run = jest.mocked(runConsole);

const result = (
    text: string,
    kind: ConsoleResult['kind'],
    reply: unknown
): ConsoleResult => ({ line: 1, text, kind, reply, ms: 1.5 });

beforeEach(() => {
    localStorage.clear(); // the editor text is kept there
    run.mockReset().mockResolvedValue([]);
    useAppStore.setState({
        consoleOutput: [],
        connections: [
            {
                id: 'shop',
                host: 'h',
                port: 6379,
                tls: false,
                cluster: false,
                tier: 'staging',
                db: 3
            }
        ],
        currentEnvironment: 'shop'
    });
});

const editor = () =>
    screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: /redis commands/i
    });

/** Types the script, then selects from the first `from` to the end of `to`. */
async function script(text: string, from: string, to?: string) {
    const user = userEvent.setup();
    render(<ConsolePage />);
    await user.type(editor(), text);
    const start = text.indexOf(from);
    editor().setSelectionRange(
        start,
        to ? text.indexOf(to) + to.length : start
    );
    return user;
}

const SCRIPT = 'PING\n  GET a  \n# note\nTTL a';

const button = (name: RegExp) => screen.getByRole('button', { name });

it('shows the Tier badge and the Connection with its db', () => {
    render(<ConsolePage />);
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('shop · db3')).toBeInTheDocument();
});

it.each([{ ctrlKey: true }, { metaKey: true }])(
    'runs the line under the cursor with %p+Enter',
    async (modifier) => {
        await script(SCRIPT, 'GET');
        fireEvent.keyDown(editor(), { key: 'Enter', ...modifier });
        expect(run).toHaveBeenCalledWith('shop', [{ line: 2, text: 'GET a' }]);
    }
);

it('runs the selected lines with Run line, leaving out comments', async () => {
    const user = await script(SCRIPT, 'GET', 'TTL');
    await user.click(button(/run line/i));
    expect(run).toHaveBeenCalledWith('shop', [
        { line: 2, text: 'GET a' },
        { line: 4, text: 'TTL a' }
    ]);
});

it('runs nothing on a comment line', async () => {
    const user = await script(SCRIPT, '# note');
    await user.click(button(/run line/i));
    expect(run).not.toHaveBeenCalled();
});

const ALL = '# head\nPING\n\n-- note\n  // note\nGET a\nTTL a';
const EVERY = [
    { line: 2, text: 'PING' },
    { line: 6, text: 'GET a' },
    { line: 7, text: 'TTL a' }
];

it('runs every statement in order with Run all', async () => {
    const user = await script(ALL, 'PING');
    await user.click(button(/^run all 3$/i));
    expect(run).toHaveBeenCalledWith('shop', EVERY);
});

it.each([{ ctrlKey: true }, { metaKey: true }])(
    'runs every statement with %p+Shift+Enter',
    async (modifier) => {
        await script(ALL, 'GET');
        fireEvent.keyDown(editor(), {
            key: 'Enter',
            shiftKey: true,
            ...modifier
        });
        expect(run).toHaveBeenCalledWith('shop', EVERY);
    }
);

const chooser = () =>
    screen.queryByRole('dialog', { name: /choose statements/i });
const checked = () =>
    screen.getAllByRole<HTMLInputElement>('checkbox').map((box) => box.checked);

it('runs the statements picked in the checklist, in editor order', async () => {
    const user = await script(ALL, 'GET');
    await user.click(button(/choose statements/i));
    expect(checked()).toEqual([false, true, false]);

    await user.click(screen.getByRole('checkbox', { name: /TTL a/ }));
    await user.click(screen.getByRole('checkbox', { name: /GET a/ }));
    await user.click(screen.getByRole('checkbox', { name: /PING/ }));
    await user.click(button(/^run 2 selected$/i));

    expect(run).toHaveBeenCalledWith('shop', [EVERY[0], EVERY[2]]);
    expect(chooser()).not.toBeInTheDocument();
});

it('picks all or none, and closes without running', async () => {
    const user = await script(ALL, 'GET');
    await user.click(button(/choose statements/i));
    await user.click(button(/^all$/i));
    expect(checked()).toEqual([true, true, true]);
    await user.click(button(/^none$/i));
    expect(checked()).toEqual([false, false, false]);
    expect(button(/^run 0 selected$/i)).toBeDisabled();

    await user.click(button(/cancel/i));
    expect(chooser()).not.toBeInTheDocument();

    await user.click(button(/choose statements/i));
    await user.keyboard('{Escape}');
    expect(chooser()).not.toBeInTheDocument();

    await user.click(button(/choose statements/i));
    await user.type(editor(), 'x');
    expect(chooser()).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
});

it('shows scalars, a one-column table and an error block', async () => {
    run.mockResolvedValue([
        result('HLEN h', 'integer', 7),
        result('PING', 'status', 'PONG'),
        result('GET s', 'bulk', 'hello'),
        result('GET nope', 'nil', null),
        result('HKEYS h', 'array', ['name', 'email']),
        result('HGETALL s', 'error', 'WRONGTYPE bad type')
    ]);
    const user = await script('PING', 'PING');
    await user.click(button(/run line/i));
    const open = async (name: string) =>
        user.click(await screen.findByRole('tab', { name }));
    const panel = () => within(screen.getByRole('tabpanel'));

    await open('1: HLEN');
    expect(panel().getByText('(integer) 7')).toBeInTheDocument();
    await open('2: PING');
    expect(panel().getByText('PONG')).toBeInTheDocument();
    await open('3: GET');
    expect(panel().getByText('hello')).toBeInTheDocument();
    await open('4: GET');
    expect(panel().getByText('(nil)')).toBeInTheDocument();
    await open('5: HKEYS');
    const cells = within(panel().getByRole('table')).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
        '1',
        'name',
        '2',
        'email'
    ]);
    await open('6: HGETALL');
    expect(panel().getByRole('alert')).toHaveTextContent('WRONGTYPE bad type');
});

const STOPPED: ConsoleResult[] = [
    { line: 2, text: 'PING', kind: 'status', reply: 'PONG', ms: 1.5 },
    { line: 6, text: 'GET a', kind: 'error', reply: 'WRONGTYPE no', ms: 2 },
    { line: 7, text: 'TTL a', kind: 'not-run', reply: null, ms: 0 }
];

it('shows one tab per statement run, with Not run after an error', async () => {
    run.mockResolvedValue(STOPPED);
    const user = await script(ALL, 'PING');
    await user.click(button(/run all/i));

    await screen.findByText('PONG');
    const ran = screen.getByRole('tablist', { name: 'Statements run' });
    expect(
        within(ran)
            .getAllByRole('tab')
            .map((t) => t.textContent)
    ).toEqual(['Output 3', '1: PING', '2: GET', '3: TTL']);
    expect(screen.getByRole('tab', { name: '1: PING' })).toHaveAttribute(
        'aria-selected',
        'true'
    );
    expect(screen.getByText('line 2 · shop · 1.5 ms')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '2: GET' }));
    expect(screen.getByRole('alert')).toHaveTextContent('WRONGTYPE no');
    await user.click(screen.getByRole('tab', { name: '3: TTL' }));
    expect(screen.getByText('Not run')).toBeInTheDocument();
});

const outputLines = () =>
    within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.textContent);

it('keeps a history of Output lines, newest first, in memory only', async () => {
    run.mockResolvedValueOnce([
        result('HKEYS h', 'array', ['name', 'email'])
    ]).mockResolvedValueOnce(STOPPED);
    const user = userEvent.setup();
    const page = render(<ConsolePage />);
    await user.type(editor(), 'PING');
    await user.click(button(/run line/i));
    await screen.findByRole('tab', { name: '1: HKEYS' });
    await user.click(button(/run line/i));
    await screen.findByRole('tab', { name: '1: PING' });

    // the history outlives the page, but is not written to the browser
    page.unmount();
    render(<ConsolePage />);

    const time = /^\[\d\d:\d\d:\d\d\] /;
    expect(outputLines().every((line) => time.test(line ?? ''))).toBe(true);
    expect(outputLines().map((line) => line?.replace(time, ''))).toEqual([
        'shop> TTL a → stopped at line 6',
        'shop> GET a → WRONGTYPE no',
        'shop> PING → PONG',
        'shop> HKEYS h → 2 rows'
    ]);
    // the editor text is stored, the replies and summaries are not
    expect(JSON.stringify(localStorage)).not.toContain('stopped at line');
});

it('does not show results from another Connection', async () => {
    run.mockResolvedValue([result('PING', 'status', 'PONG')]);
    const user = await script('PING', 'PING');
    await user.click(button(/run line/i));
    await screen.findByText('PONG');

    act(() => useAppStore.setState({ currentEnvironment: 'other' }));

    expect(screen.queryByText('PONG')).not.toBeInTheDocument();
    // the Output history stays, naming the Connection each line ran on
    expect(screen.getByRole('list')).toHaveTextContent('shop> PING → PONG');
});
