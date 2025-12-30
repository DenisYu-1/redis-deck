import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import { getCommandStats } from '@/services/apiService';
import { formatNumber } from '@/utils/formatter';
import type { CommandStatsResponse } from '@/types';

export function CommandStatsTable() {
    const [commandStats, setCommandStats] =
        useState<CommandStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchCommandStats = async () => {
            if (!currentEnvironment) return;

            setIsLoading(true);
            try {
                const data = await getCommandStats(currentEnvironment);
                setCommandStats(data);
            } catch (error) {
                showToast('Failed to load command stats', 'error');
                console.error('Error loading command stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCommandStats();
    }, [currentEnvironment, showToast]);

    return (
        <div className="charts-section">
            <div className="chart-header">
                <h3>Top Commands (by calls)</h3>
                <div className="command-stats-timeframe" id="command-stats-timeframe">
                    {commandStats
                        ? `Uptime: ${commandStats.uptime_days} days`
                        : 'Loading...'}
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="command-stats-table">
                    <thead>
                        <tr>
                            <th>Command</th>
                            <th>Total Calls</th>
                            <th>Calls/sec</th>
                            <th>Total Time (ms)</th>
                            <th>Avg Time (μs)</th>
                        </tr>
                    </thead>
                    <tbody id="command-stats-table">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5}>Loading...</td>
                            </tr>
                        ) : commandStats?.commands.length ? (
                            commandStats.commands.map((cmd, index) => (
                                <tr key={index}>
                                    <td>
                                        <code>{cmd.command}</code>
                                    </td>
                                    <td>{formatNumber(cmd.calls)}</td>
                                    <td>{cmd.calls_per_sec.toFixed(2)}</td>
                                    <td>{formatNumber(Math.round(cmd.usec / 1000))}</td>
                                    <td>{cmd.usec_per_call.toFixed(2)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5}>No command statistics available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
