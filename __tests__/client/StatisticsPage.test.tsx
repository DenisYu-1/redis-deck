import { cleanup, render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StatisticsApp } from '@/pages/Statistics/StatisticsApp';
import { useAppStore } from '@/store/useAppStore';
import { getHistoryStats, getRealtimeStats } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({
    getHistoryStats: jest.fn(),
    getRealtimeStats: jest.fn(),
    takeSnapshot: jest.fn()
}));
jest.mock('@/pages/Statistics/components/charts', () => ({
    MemoryChart: () => <div>CHART-MEMORY</div>,
    KeyspaceChart: () => <div>CHART-KEYSPACE</div>,
    HitRateChart: () => <div>CHART-HITRATE</div>,
    OpsChart: () => <div>CHART-OPS</div>
}));
jest.mock('@/pages/Statistics/components/CommandStatsTable', () => ({
    CommandStatsTable: () => <div>COMMANDS</div>
}));
jest.mock('@/pages/Statistics/components/SlowLogTable', () => ({
    SlowLogTable: () => <div>SLOWLOG</div>
}));
jest.mock('@/pages/Statistics/components/MemoryPatternAnalysis', () => ({
    MemoryPatternAnalysis: () => <div>PATTERNS</div>
}));

const history = (n: number) => ({
    from: 0,
    to: 0,
    count: 2,
    data: [100, 110].map((ts, i) => ({
        timestamp: ts,
        memory_used: 1000,
        memory_peak: 1000,
        total_keys: 5,
        keyspace_hits: 90,
        keyspace_misses: 10,
        instantaneous_ops_per_sec: n + i,
        total_net_input_bytes: 0,
        total_net_output_bytes: 0,
        connected_clients: 2,
        used_cpu_sys: 0,
        used_cpu_user: 0
    }))
});

const realtime = (ops: number, hits = 90, misses = 10) => ({
    memory: { used: 2048 },
    stats: { keyspace_hits: hits, keyspace_misses: misses, ops_per_sec: ops },
    clients: { connected: 3 },
    cpu: { used_cpu_sys: 0, used_cpu_user: 0 },
    keyspace: { db0: 'keys=8,expires=0,avg_ttl=0' }
});

const tileText = (id: string) => screen.getByTestId(`tile-${id}`).textContent;

beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
    (getHistoryStats as jest.Mock).mockReset().mockResolvedValue(history(1));
    (getRealtimeStats as jest.Mock).mockReset().mockResolvedValue(realtime(50));
    useAppStore.setState({ currentEnvironment: 'local' });
});
afterEach(() => jest.useRealTimers());

const setup = (path = '/stats') => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/stats" element={<StatisticsApp />} />
                <Route path="/stats/:board" element={<StatisticsApp />} />
            </Routes>
        </MemoryRouter>
    );
    return user;
};

describe('Statistics page', () => {
    it('shows the caption and the five ranges, without 15m', async () => {
        setup();
        expect(
            await screen.findByText(/Snapshots every 5 min · 30-day retention/)
        ).toBeInTheDocument();
        for (const r of ['1h', '6h', '24h', '7d', '30d']) {
            expect(screen.getByRole('button', { name: r })).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: '15m' })).toBeNull();
    });

    it('renders the six tiles with live values and a hit-rate warning', async () => {
        (getRealtimeStats as jest.Mock).mockResolvedValue(realtime(50, 80, 20));
        setup();
        await waitFor(() => expect(tileText('ops')).toContain('50'));
        expect(tileText('clients')).toContain('3');
        expect(tileText('keys')).toContain('8');
        expect(tileText('hit')).toContain('80.0');
        expect(screen.getByTestId('tile-hit')).toHaveAttribute(
            'data-state',
            'warn'
        );
        for (const t of [
            'Ops/sec',
            'Memory',
            'Hit rate',
            'Clients',
            'CPU',
            'Keys'
        ]) {
            expect(screen.getByText(t)).toBeInTheDocument();
        }
    });

    it('loads history for the selected range', async () => {
        const user = setup();
        await waitFor(() =>
            expect(getHistoryStats).toHaveBeenLastCalledWith('local', 24)
        );
        await user.click(screen.getByRole('button', { name: '6h' }));
        await waitFor(() =>
            expect(getHistoryStats).toHaveBeenLastCalledWith('local', 6)
        );
        await user.click(screen.getByRole('button', { name: '7d' }));
        await waitFor(() =>
            expect(getHistoryStats).toHaveBeenLastCalledWith('local', 168)
        );
    });

    it('Live polls realtime every 10 s without refetching history; Paused stops', async () => {
        const user = setup();
        await waitFor(() => expect(getRealtimeStats).toHaveBeenCalledTimes(1));
        const historyCalls = (getHistoryStats as jest.Mock).mock.calls.length;

        (getRealtimeStats as jest.Mock).mockResolvedValue(realtime(99));
        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        await waitFor(() => expect(tileText('ops')).toContain('99'));
        expect(getRealtimeStats).toHaveBeenCalledTimes(2);
        expect(getHistoryStats).toHaveBeenCalledTimes(historyCalls);

        await user.click(screen.getByRole('button', { name: /Live/ }));
        expect(
            screen.getByRole('button', { name: /Paused/ })
        ).toBeInTheDocument();
        await act(async () => {
            jest.advanceTimersByTime(30000);
        });
        expect(getRealtimeStats).toHaveBeenCalledTimes(2);
    });

    it('omits out-of-scope features', async () => {
        setup();
        await screen.findByText('CHART-MEMORY');
        expect(screen.getByText('COMMANDS')).toBeInTheDocument();
        expect(screen.getByText('SLOWLOG')).toBeInTheDocument();
        expect(screen.getByText('PATTERNS')).toBeInTheDocument();
        for (const re of [/widget/i, /latency/i, /queue/i]) {
            expect(screen.queryByText(re)).toBeNull();
            expect(screen.queryByRole('button', { name: re })).toBeNull();
        }
    });

    it('/stats/memory renders the Memory deep-dive board, not Overview', async () => {
        setup('/stats/memory');
        expect(
            await screen.findByRole('heading', { name: 'Memory deep-dive' })
        ).toBeInTheDocument();
        expect(screen.getByText('CHART-MEMORY')).toBeInTheDocument();
        expect(screen.getByText('PATTERNS')).toBeInTheDocument();
        expect(screen.queryByText('COMMANDS')).toBeNull();
        expect(screen.queryByText('CHART-OPS')).toBeNull();
        expect(screen.getByTestId('tile-mem')).toBeInTheDocument();
        expect(screen.queryByTestId('tile-ops')).toBeNull();
    });

    it('removes a widget, restores it, and persists across remounts per board', async () => {
        const user = setup();
        await screen.findByText('CHART-OPS');
        await user.click(screen.getByRole('button', { name: 'Edit layout' }));
        await user.click(
            screen.getByRole('button', { name: 'Remove Operations/sec' })
        );
        expect(screen.queryByText('CHART-OPS')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();

        cleanup();
        setup();
        await screen.findByText('CHART-MEMORY');
        expect(screen.queryByText('CHART-OPS')).toBeNull();
        cleanup();
        setup('/stats/memory');
        await screen.findByText('CHART-MEMORY');

        cleanup();
        const user2 = setup();
        await user2.click(
            await screen.findByRole('button', { name: 'Restore removed' })
        );
        expect(screen.getByText('CHART-OPS')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Restore removed' })
        ).toBeNull();
    });

    it('shows an empty-board state when every widget is removed', async () => {
        const user = setup('/stats/memory');
        await screen.findByText('CHART-MEMORY');
        await user.click(screen.getByRole('button', { name: 'Edit layout' }));
        for (const name of [
            'Key metrics',
            'Memory usage',
            'Keyspace',
            'Memory by pattern'
        ]) {
            await user.click(
                screen.getByRole('button', { name: `Remove ${name}` })
            );
        }
        expect(screen.getByTestId('empty-board')).toBeInTheDocument();
        await user.click(
            screen.getByRole('button', { name: 'Restore removed' })
        );
        expect(screen.queryByTestId('empty-board')).toBeNull();
        expect(screen.getByText('CHART-MEMORY')).toBeInTheDocument();
    });
});
