import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConsolePage } from '@/pages/Console/ConsolePage';
import { useAppStore } from '@/store/useAppStore';

const LIST = {
    commands: {
        PING: { access: 'read' },
        GET: { access: 'read' },
        KEYS: { access: 'read', warning: 'KEYS blocks Redis. Prefer SCAN.' },
        'CONFIG GET': { access: 'read' },
        SET: { access: 'write' }
    },
    turnedOff: {
        FLUSHDB: 'FLUSHDB is disabled in the console',
        'CONFIG SET': 'CONFIG SET is disabled in the console'
    },
    unsupported: '{command} is not supported in this console'
};

// the list is kept for the whole page load, so calls are counted per file
const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => LIST
}));
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => localStorage.clear());

/** Opens the Console on `shop` with the script in the editor. */
async function open(script: string, readOnly = false) {
    useAppStore.setState({
        consoleOutput: [],
        connections: [
            {
                id: 'shop',
                host: 'h',
                port: 6379,
                tls: false,
                cluster: false,
                readOnly
            }
        ],
        currentEnvironment: 'shop'
    });
    const view = render(<ConsolePage />);
    fireEvent.change(screen.getByRole('textbox'), {
        target: { value: script }
    });
    await act(async () => {}); // the list arrives
    return view;
}

/** Every mark, as `[accessible name, kind]`. */
const marks = () =>
    screen
        .queryAllByRole('img')
        .map((m) => [m.getAttribute('aria-label'), m.dataset.mark]);

it('marks an unsupported command with the message the server gives', async () => {
    await open('PING\nbogus x\nconfig help\nCONFIG');
    expect(marks()).toEqual([
        ['Line 2: BOGUS is not supported in this console', 'error'],
        ['Line 3: CONFIG HELP is not supported in this console', 'error'],
        ['Line 4: CONFIG is not supported in this console', 'error']
    ]);
});

it('marks a command that is turned off in the console', async () => {
    await open('flushdb\nCONFIG set maxmemory 0\nCONFIG GET maxmemory');
    expect(marks()).toEqual([
        ['Line 1: FLUSHDB is disabled in the console', 'error'],
        ['Line 2: CONFIG SET is disabled in the console', 'error']
    ]);
});

it('reads quoted command names as the server does', async () => {
    await open('"set" a 1\n\'CONFIG\' "GET" x\nP"IN"G\n"PING');
    expect(marks()).toEqual([
        ['Line 1: Writes data', 'write'],
        ['Line 3: P"IN"G is not supported in this console', 'error'],
        ['Line 4: "PING is not supported in this console', 'error']
    ]);
});

it('marks a quoted multi-word command as unsupported', async () => {
    await open('"CONFIG GET" maxmemory');
    expect(marks()).toEqual([
        ['Line 1: "CONFIG GET" is not supported in this console', 'error']
    ]);
});

it('marks a write as writing data', async () => {
    await open('GET a\nset a 1');
    expect(marks()).toEqual([['Line 2: Writes data', 'write']]);
});

it('marks a write on a Read-only Connection as an error', async () => {
    await open('GET a\nSET a 1', true);
    expect(marks()).toEqual([['Line 2: shop is read-only', 'error']]);
});

it('warns where the list carries a warning', async () => {
    await open('KEYS *');
    expect(marks()).toEqual([
        ['Line 1: KEYS blocks Redis. Prefer SCAN.', 'warning']
    ]);
});

it('leaves comment and empty lines unmarked', async () => {
    await open('# FLUSHDB\n-- SET a 1\n  // bogus\n\n');
    expect(marks()).toEqual([]);
});

it('fetches the allowed list once', async () => {
    (await open('SET a 1')).unmount();
    await open('SET b 2');
    expect(marks()).toEqual([['Line 1: Writes data', 'write']]);
    expect(fetchMock.mock.calls).toEqual([['/api/console/commands']]);
});
