import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
    reply: unknown,
    kind: ConsoleResult['kind'] = 'array'
): ConsoleResult => ({ line: 1, text, kind, reply, ms: 1.5 });

beforeEach(() => {
    localStorage.clear();
    run.mockReset();
    useAppStore.setState({
        consoleOutput: [],
        connections: [
            { id: 'shop', host: 'h', port: 6379, tls: false, cluster: false }
        ],
        currentEnvironment: 'shop',
        selectedKey: null
    });
});

/** Runs one line; the server answers with `reply`. */
async function show(reply: ConsoleResult) {
    run.mockResolvedValueOnce([reply]);
    const user = userEvent.setup();
    render(
        <MemoryRouter initialEntries={['/console']}>
            <Routes>
                <Route path="/console" element={<ConsolePage />} />
                <Route path="/keys" element={<h1>Keys page</h1>} />
            </Routes>
        </MemoryRouter>
    );
    await user.type(screen.getByRole('textbox'), 'PING');
    await user.click(screen.getByRole('button', { name: /run line/i }));
    await screen.findByRole('tab', { name: /^1: / });
    return user;
}

const panel = () => within(screen.getByRole('tabpanel'));
const headers = () =>
    panel()
        .getAllByRole('columnheader')
        .map((th) => th.textContent);
/** The body rows' cells, without the row number. */
const rows = () =>
    within(panel().getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((tr) =>
            within(tr)
                .getAllByRole('cell')
                .slice(1)
                .map((td) => td.textContent)
        );

it.each([
    ['HGETALL h', ['name', 'Ada', 'age', '36'], ['field', 'value']],
    ['config get "max*"', ['name', 'Ada', 'age', '36'], ['parameter', 'value']],
    [
        'ZRANGE z 0 -1 withscores',
        // RESP3 nests each pair; RESP2 sends them flat
        [
            ['name', 'Ada'],
            ['age', '36']
        ],
        ['member', 'score']
    ]
])('shows the pairs of %s as two columns', async (text, reply, columns) => {
    await show(result(text, reply));

    expect(headers()).toEqual(['#', ...columns]);
    expect(rows()).toEqual([
        ['name', 'Ada'],
        ['age', '36']
    ]);
    expect(panel().getByText('2 rows')).toBeInTheDocument();
});

it('shows a flat array as one column', async () => {
    await show(result('ZRANGE z 0 -1', ['a', 'b']));

    expect(headers()).toEqual(['#', 'value']);
    expect(rows()).toEqual([['a'], ['b']]);
});

it('counts pairs as rows in the Output history', async () => {
    const user = await show(result('HGETALL h', ['name', 'Ada', 'age', '36']));
    await user.click(screen.getByRole('tab', { name: /^Output/ }));

    expect(screen.getByRole('listitem')).toHaveTextContent(
        'HGETALL h → 2 rows'
    );
});

it('shows SCAN as the Key list and continues from the cursor', async () => {
    const user = await show(
        result('SCAN 0 MATCH "user *" COUNT 10', ['17', ['user 1']])
    );
    expect(headers()).toEqual(['#', 'key']);
    expect(rows()).toEqual([['user 1']]);

    const next = 'SCAN 17 MATCH "user *" COUNT 10';
    run.mockResolvedValueOnce([result(next, ['0', ['user 2']])]);
    await user.click(
        panel().getByRole('button', { name: 'Continue from cursor 17' })
    );

    expect(run).toHaveBeenLastCalledWith('shop', [{ line: 1, text: next }]);
    // the next page takes the place of this one
    expect(await panel().findByText('user 2')).toBeInTheDocument();
    expect(rows()).toEqual([['user 2']]);
    expect(panel().getByText('cursor 0 · iteration complete')).toBeVisible();
    expect(panel().queryByRole('button', { name: /continue/i })).toBeNull();
    expect(screen.getByRole('tab', { name: '1: SCAN' })).toHaveAttribute(
        'aria-selected',
        'true'
    );
});

it('can continue a SCAN page that found nothing', async () => {
    await show(result('SCAN 0', ['5', []]));

    expect(
        panel().getByRole('button', { name: 'Continue from cursor 5' })
    ).toBeEnabled();
});

it.each([
    result('SCAN 0', ['0', ['user:1']]),
    result('keys user:*', ['user:1']),
    result('RANDOMKEY', 'user:1', 'bulk')
])('opens a Key of $text on the Keys page', async (reply) => {
    const user = await show(reply);

    await user.click(panel().getByRole('button', { name: 'user:1' }));

    expect(screen.getByRole('heading', { name: 'Keys page' })).toBeVisible();
    expect(useAppStore.getState().selectedKey).toBe('user:1');
});

it('does not link other replies', async () => {
    await show(result('HKEYS h', ['user:1']));

    expect(panel().queryByRole('button', { name: 'user:1' })).toBeNull();
});

const JSON_TEXT = '{"a":1}';
const PHP_TEXT = 'a:1:{s:1:"a";i:1;}';
const PRETTY = '{\n  "a": 1\n}';

it.each([
    [JSON_TEXT, 'JSON'],
    [PHP_TEXT, 'PHP']
])('decodes the bulk value %s like the Keys page', async (value, format) => {
    const user = await show(result('GET k', value, 'bulk'));
    const inspector = within(
        panel().getByRole('region', { name: 'Value inspector' })
    );
    const shown = () => panel().getByRole('region').querySelector('pre');

    expect(
        inspector.getByRole('button', { name: `Auto · ${format}` })
    ).toBeInTheDocument();
    expect(shown()?.textContent).toBe(PRETTY);

    await user.click(inspector.getByRole('button', { name: 'Raw' }));
    expect(shown()?.textContent).toBe(value);
});

it('decodes table cells, and leaves plain ones alone', async () => {
    await show(result('HGETALL h', ['j', JSON_TEXT, 'p', PHP_TEXT, 'n', '5']));

    expect(rows()).toEqual([
        ['j', `json${PRETTY}`],
        ['p', `php${PRETTY}`],
        ['n', '5']
    ]);
});

const MANY = Array.from({ length: 501 }, (_, i) => `v${i}`);

it('shows at most 500 rows, and says so', async () => {
    await show(result('HKEYS h', MANY));

    // and the header row
    expect(panel().getAllByRole('row')).toHaveLength(501);
    expect(panel().queryByText('v500')).toBeNull();
    expect(panel().getByText('501 rows · showing 500')).toBeInTheDocument();
});

it.each([
    ['a flat array', result('HKEYS h', ['a', JSON_TEXT]), ['a', JSON_TEXT]],
    [
        'pairs',
        result('HGETALL h', ['name', 'Ada']),
        [{ field: 'name', value: 'Ada' }]
    ],
    ['SCAN', result('SCAN 0', ['0', ['k1']]), ['k1']],
    ['every row, also the hidden ones', result('HKEYS h', MANY), MANY]
])('copies %s as JSON', async (_, reply, copied) => {
    const user = await show(reply);

    await user.click(panel().getByRole('button', { name: 'Copy JSON' }));

    const text = await navigator.clipboard.readText();
    expect(JSON.parse(text)).toEqual(copied);
});

it('has no Copy JSON for a scalar', async () => {
    await show(result('GET k', 'v', 'bulk'));

    expect(panel().queryByRole('button', { name: 'Copy JSON' })).toBeNull();
});

it('names the cluster Node that answered', async () => {
    await show({
        ...result('DBSIZE', 3, 'integer'),
        node: '10.0.0.7:7001'
    });

    expect(panel().getByText(/node 10\.0\.0\.7:7001/)).toBeInTheDocument();
});
