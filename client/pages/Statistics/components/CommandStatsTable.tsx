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
                <div
                    style={{
                        fontSize: '0.9em',
                        color: 'var(--text-secondary)'
                    }}
                    id="command-stats-timeframe"
                >
                    {commandStats
                        ? `Uptime: ${commandStats.uptime_days} days`
                        : 'Loading...'}
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                textAlign: 'left'
                            }}
                        >
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Command
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Total Calls
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Calls/sec
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Total Time (ms)
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Avg Time (μs)
                            </th>
                        </tr>
                    </thead>
                    <tbody id="command-stats-table">
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    style={{
                                        padding: '20px',
                                        textAlign: 'center',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    Loading...
                                </td>
                            </tr>
                        ) : commandStats?.commands.length ? (
                            commandStats.commands.map((cmd, index) => (
                                <tr
                                    key={index}
                                    style={{
                                        borderBottom:
                                            index <
                                            commandStats.commands.length - 1
                                                ? '1px solid var(--border-secondary)'
                                                : 'none'
                                    }}
                                >
                                    <td style={{ padding: '12px' }}>
                                        <code
                                            style={{
                                                backgroundColor:
                                                    'var(--bg-tertiary)',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontFamily: 'monospace',
                                                fontSize: '0.9em'
                                            }}
                                        >
                                            {cmd.command}
                                        </code>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatNumber(cmd.calls)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {cmd.calls_per_sec.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatNumber(
                                            Math.round(cmd.usec / 1000)
                                        )}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {cmd.usec_per_call.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={5}
                                    style={{
                                        padding: '20px',
                                        textAlign: 'center',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    No command statistics available
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
