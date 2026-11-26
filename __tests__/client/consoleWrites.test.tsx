import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmWriteHost } from '@/components/ui/ConfirmWriteHost';
import { ConsolePage } from '@/pages/Console/ConsolePage';
import { useAppStore } from '@/store/useAppStore';
import { subscribeToasts } from '@/utils/toast';
import type { ConnectionTier } from '@/types';

const fetchMock = jest.fn();
const WRITES = [
    { line: 2, text: 'SET a 1' },
    { line: 3, text: 'DEL b' }
];

const reply = (status: number, body: unknown) => ({
    ok: status === 200,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
});
const needsConfirmation = reply(428, {
    error: 'need confirmation',
    writes: WRITES
});
const ran = reply(200, {
    results: [{ line: 1, text: 'PING', kind: 'status', reply: 'PONG', ms: 1 }]
});

beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
});

/** Opens the Console on `shop` and presses Run all on one read and two writes. */
async function runBatch(tier: ConnectionTier) {
    useAppStore.setState({
        consoleOutput: [],
        connections: [
            {
                id: 'shop',
                host: 'h',
                port: 6379,
                tls: false,
                cluster: false,
                tier
            }
        ],
        currentEnvironment: 'shop'
    });
    const user = userEvent.setup();
    render(
        <>
            <ConsolePage />
            <ConfirmWriteHost />
        </>
    );
    fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'PING\nSET a 1\nDEL b' }
    });
    await user.click(screen.getByRole('button', { name: /run all/i }));
    return user;
}

const sentHeaders = (call: number) =>
    (fetchMock.mock.calls[call][1] as RequestInit).headers;
const sentBody = (call: number) =>
    (fetchMock.mock.calls[call][1] as RequestInit).body;

it('lists the writes in a modal and retries with the confirmation', async () => {
    fetchMock
        .mockResolvedValueOnce(needsConfirmation)
        .mockResolvedValueOnce(ran);
    const user = await runBatch('staging');

    const dialog = await screen.findByRole('dialog', {
        name: 'Run 2 writes on shop?'
    });
    expect(dialog).toHaveTextContent('SET a 1');
    expect(dialog).toHaveTextContent('DEL b');
    expect(dialog).toHaveTextContent('The 1 read statement runs too.');
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders(0)).not.toHaveProperty('X-Confirm-Connection');

    await user.click(within(dialog).getByRole('button', { name: 'Run' }));

    expect(await screen.findByText('PONG')).toBeInTheDocument();
    expect(sentHeaders(1)).toHaveProperty('X-Confirm-Connection', 'shop');
    expect(sentBody(1)).toBe(sentBody(0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('asks for the Connection name on production', async () => {
    fetchMock
        .mockResolvedValueOnce(needsConfirmation)
        .mockResolvedValueOnce(ran);
    const user = await runBatch('production');

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Run' });
    const name = within(dialog).getByLabelText(/connection name/i);
    expect(confirm).toBeDisabled();
    await user.type(name, 'sho{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(name, 'p');
    await user.click(confirm);

    expect(await screen.findByText('PONG')).toBeInTheDocument();
    expect(sentHeaders(1)).toHaveProperty('X-Confirm-Connection', 'shop');
});

it('runs nothing on cancel', async () => {
    fetchMock.mockResolvedValueOnce(needsConfirmation);
    const user = await runBatch('production');

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().consoleOutput).toEqual([]);
    // and the Console is free to run again
    fetchMock.mockResolvedValueOnce(ran);
    await user.click(screen.getByRole('button', { name: /run all/i }));
    expect(await screen.findByText('PONG')).toBeInTheDocument();
});

it('shows a Read-only refusal once, without asking', async () => {
    let toasts: string[] = [];
    const off = subscribeToasts((t) => {
        toasts = t.map((x) => x.message);
    });
    fetchMock.mockResolvedValueOnce(
        reply(403, {
            error: "Connection 'shop' is read-only",
            writes: WRITES
        })
    );

    await runBatch('staging');

    await screen.findByRole('button', { name: /run all/i });
    expect(toasts).toEqual(["Connection 'shop' is read-only"]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    off();
});
