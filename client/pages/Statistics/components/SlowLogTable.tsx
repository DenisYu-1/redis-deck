import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import { getSlowLog } from '@/services/apiService';
import type { SlowLogResponse } from '@/types';

export function SlowLogTable() {
    const [slowLog, setSlowLog] = useState<SlowLogResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchSlowLog = async () => {
            if (!currentEnvironment) return;

            setIsLoading(true);
            try {
                const data = await getSlowLog(currentEnvironment);
                setSlowLog(data);
            } catch (error) {
                showToast('Failed to load slow log', 'error');
                console.error('Error loading slow log:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSlowLog();
    }, [currentEnvironment, showToast]);

    const formatDuration = (us: number) => {
        if (us < 1000) return `${us}μs`;
        if (us < 1000000) return `${(us / 1000).toFixed(1)}ms`;
        return `${(us / 1000000).toFixed(2)}s`;
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
    };

    return (
        <div className="charts-section">
            <div className="chart-header">
                <h3>Recent Slow Queries</h3>
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
                                ID
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Time
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Duration
                            </th>
                            <th
                                style={{
                                    padding: '12px',
                                    borderBottom:
                                        '2px solid var(--border-primary)'
                                }}
                            >
                                Command
                            </th>
                        </tr>
                    </thead>
                    <tbody id="slowlog-table">
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    style={{
                                        padding: '20px',
                                        textAlign: 'center',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    Loading...
                                </td>
                            </tr>
                        ) : slowLog?.slowlog.length ? (
                            slowLog.slowlog.map((entry) => (
                                <tr
                                    key={entry.id}
                                    style={{
                                        borderBottom:
                                            '1px solid var(--border-secondary)'
                                    }}
                                >
                                    <td style={{ padding: '12px' }}>
                                        {entry.id}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatTimestamp(entry.timestamp)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatDuration(entry.duration_us)}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <code
                                            style={{
                                                backgroundColor:
                                                    'var(--bg-tertiary)',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontFamily: 'monospace',
                                                fontSize: '0.9em',
                                                wordBreak: 'break-all'
                                            }}
                                        >
                                            {entry.command}
                                        </code>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={4}
                                    style={{
                                        padding: '20px',
                                        textAlign: 'center',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    No slow queries found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
