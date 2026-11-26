import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsolePage } from '@/pages/Console/ConsolePage';
import { runConsole, type ConsoleResult } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@/services/apiService', () => ({ runConsole: jest.fn() }));
const run = jest.mocked(runConsole);

const result = (
    text: string,
    kind: ConsoleResult['kind'],
    reply: unknown
): ConsoleResult => ({ line: 1, text, kind, reply, ms: 1.5 });

beforeEach(() => {
    run.mockReset().mockResolvedValue([]);
    useAppStore.setState({
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
    await user.click(screen.getByRole('button', { name: /run line/i }));
    expect(run).toHaveBeenCalledWith('shop', [
        { line: 2, text: 'GET a' },
        { line: 4, text: 'TTL a' }
    ]);
});

it('runs nothing on a comment line', async () => {
    const user = await script(SCRIPT, '# note');
    await user.click(screen.getByRole('button', { name: /run line/i }));
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
    await user.click(screen.getByRole('button', { name: /run line/i }));

    expect(await screen.findByText('(integer) 7')).toBeInTheDocument();
    expect(screen.getByText('PONG')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('(nil)')).toBeInTheDocument();
    const cells = within(screen.getByRole('table')).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
        '1',
        'name',
        '2',
        'email'
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent('WRONGTYPE bad type');
});

it('does not show results from another Connection', async () => {
    run.mockResolvedValue([result('PING', 'status', 'PONG')]);
    const user = await script('PING', 'PING');
    await user.click(screen.getByRole('button', { name: /run line/i }));
    await screen.findByText('PONG');

    act(() => useAppStore.setState({ currentEnvironment: 'other' }));

    expect(screen.queryByText('PONG')).not.toBeInTheDocument();
});
