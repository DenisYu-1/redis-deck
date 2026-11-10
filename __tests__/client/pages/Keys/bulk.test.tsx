import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionBar } from '@/pages/Keys/SelectionBar';
import { BulkTtlDialog } from '@/pages/Keys/BulkTtlDialog';
import { setKeysTtl, exportKeys, deleteKeys } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';

describe('SelectionBar', () => {
    const noop = () => undefined;
    const bar = (over: Partial<Parameters<typeof SelectionBar>[0]> = {}) => (
        <SelectionBar
            count={3}
            matched={1200}
            readOnly={false}
            onClear={noop}
            onTtl={noop}
            onExport={noop}
            onDelete={noop}
            {...over}
        />
    );

    it('renders nothing when nothing is selected', () => {
        const { container } = render(bar({ count: 0 }));
        expect(container).toBeEmptyDOMElement();
    });

    it('shows "N selected of M matched"', () => {
        render(bar());
        expect(screen.getByText('3 selected')).toBeInTheDocument();
        expect(screen.getByText('of 1,200 matched')).toBeInTheDocument();
    });

    it('wires Clear, Set TTL, Export and Delete', async () => {
        const fns = {
            onClear: jest.fn(),
            onTtl: jest.fn(),
            onExport: jest.fn(),
            onDelete: jest.fn()
        };
        render(bar(fns));
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
        await userEvent.click(screen.getByRole('button', { name: 'Set TTL' }));
        await userEvent.click(screen.getByRole('button', { name: 'Export' }));
        await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
        for (const fn of Object.values(fns))
            expect(fn).toHaveBeenCalledTimes(1);
    });

    it('disables the writes (not Export) on a read-only connection', () => {
        render(bar({ readOnly: true }));
        expect(screen.getByRole('button', { name: 'Set TTL' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    });
});

describe('BulkTtlDialog', () => {
    it('submits seconds', async () => {
        const onSubmit = jest.fn();
        render(
            <BulkTtlDialog count={2} onSubmit={onSubmit} onClose={jest.fn()} />
        );
        await userEvent.type(screen.getByLabelText('TTL in seconds'), '90');
        await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(onSubmit).toHaveBeenCalledWith(90);
    });

    it('submits null for "Remove expiry"', async () => {
        const onSubmit = jest.fn();
        render(
            <BulkTtlDialog count={2} onSubmit={onSubmit} onClose={jest.fn()} />
        );
        await userEvent.click(screen.getByLabelText('Remove expiry (PERSIST)'));
        await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(onSubmit).toHaveBeenCalledWith(null);
    });

    it('will not apply without a positive number', async () => {
        render(
            <BulkTtlDialog count={2} onSubmit={jest.fn()} onClose={jest.fn()} />
        );
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });
});

describe('bulk api calls', () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock as unknown as typeof fetch;
        useAppStore.setState({
            connections: [
                { id: 'safe', host: 'h', port: 1, tls: false, cluster: false },
                {
                    id: 'prod',
                    host: 'h',
                    port: 1,
                    tls: false,
                    cluster: false,
                    confirmWrites: true
                }
            ]
        });
    });
    const ok = (body: unknown) =>
        fetchMock.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(body)
        });

    it('setKeysTtl posts keys and seconds', async () => {
        ok({ updated: 2 });
        await expect(setKeysTtl(['a', 'b'], 60, 'safe')).resolves.toEqual({
            updated: 2
        });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/keys/ttl?env=safe');
        expect(JSON.parse(init.body as string)).toEqual({
            keys: ['a', 'b'],
            seconds: 60
        });
    });

    it('deleteKeys is confirm-aware: sends the header after the typed name matches', async () => {
        ok({ deleted: 1 });
        jest.spyOn(window, 'prompt').mockReturnValue('prod');
        await deleteKeys(['a'], 'prod');
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(
            (init.headers as Record<string, string>)['X-Confirm-Connection']
        ).toBe('prod');
    });

    it('deleteKeys is cancelled when the typed name is wrong', async () => {
        jest.spyOn(window, 'prompt').mockReturnValue('nope');
        await expect(deleteKeys(['a'], 'prod')).rejects.toThrow(/cancelled/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exportKeys returns the entries', async () => {
        const entries = [{ key: 'a', type: 'string', ttl: -1, value: 'x' }];
        ok(entries);
        await expect(exportKeys(['a'], 'safe')).resolves.toEqual(entries);
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toBe('/api/keys/export?env=safe');
    });
});
