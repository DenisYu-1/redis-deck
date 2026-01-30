import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import { getHistoryStats, takeSnapshot } from '@/services/apiService';
import { formatBytes } from '@/utils/formatter';
import type { HistoryResponse } from '@/types';
import Chart from 'chart.js/auto';

export function ChartsSection() {
    const [timeRange, setTimeRange] = useState(24);
    const [charts] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(false);
    const { currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    const fetchHistoryData = async (hours: number) => {
        if (!currentEnvironment) return;

        setIsLoading(true);
        try {
            const data = await getHistoryStats(currentEnvironment, hours);
            updateCharts(data);
        } catch (error) {
            showToast('Failed to load chart data', 'error');
            console.error('Error loading history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateCharts = (historyData: HistoryResponse) => {
        if (!historyData.data.length) return;

        const labels = historyData.data.map((point) =>
            new Date(point.timestamp * 1000).toLocaleTimeString()
        );

        // Memory Chart
        updateMemoryChart(labels, historyData.data);
        // Keys Chart
        updateKeysChart(labels, historyData.data);
        // Hit Rate Chart
        updateHitRateChart(labels, historyData.data);
        // Ops Chart
        updateOpsChart(labels, historyData.data);
        // Network Chart
        updateNetworkChart(labels, historyData.data);
    };

    const updateMemoryChart = (
        labels: string[],
        data: HistoryResponse['data']
    ) => {
        const ctx = (
            document.getElementById('memoryChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const memoryData = data.map((point) => point.memory_used);
        const peakData = data.map((point) => point.memory_peak);

        if (charts.memoryChart) {
            charts.memoryChart.destroy();
        }

        charts.memoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Memory Used',
                        data: memoryData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Memory Peak',
                        data: peakData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context: any) =>
                                `${context.dataset.label}: ${formatBytes(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value: any) =>
                                formatBytes(value as number)
                        }
                    }
                }
            }
        });
    };

    const updateKeysChart = (
        labels: string[],
        data: HistoryResponse['data']
    ) => {
        const ctx = (
            document.getElementById('keysChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const keysData = data.map((point) => point.total_keys);

        if (charts.keysChart) {
            charts.keysChart.destroy();
        }

        charts.keysChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Total Keys',
                        data: keysData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } }
            }
        });
    };

    const updateHitRateChart = (
        labels: string[],
        data: HistoryResponse['data']
    ) => {
        const ctx = (
            document.getElementById('hitRateChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const hitRateData = data.map((point) => {
            const total = point.keyspace_hits + point.keyspace_misses;
            return total > 0 ? (point.keyspace_hits / total) * 100 : 0;
        });

        if (charts.hitRateChart) {
            charts.hitRateChart.destroy();
        }

        charts.hitRateChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Hit Rate (%)',
                        data: hitRateData,
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    };

    const updateOpsChart = (
        labels: string[],
        data: HistoryResponse['data']
    ) => {
        const ctx = (
            document.getElementById('opsChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const opsData = data.map((point) => point.instantaneous_ops_per_sec);

        if (charts.opsChart) {
            charts.opsChart.destroy();
        }

        charts.opsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Operations/sec',
                        data: opsData,
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } }
            }
        });
    };

    const updateNetworkChart = (
        labels: string[],
        data: HistoryResponse['data']
    ) => {
        const ctx = (
            document.getElementById('networkChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const networkData = data.map(
            (point) =>
                point.total_net_input_bytes + point.total_net_output_bytes
        );

        if (charts.networkChart) {
            charts.networkChart.destroy();
        }

        charts.networkChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Network I/O (MB)',
                        data: networkData,
                        borderColor: '#1abc9c',
                        backgroundColor: 'rgba(26, 188, 156, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context: any) =>
                                `${context.dataset.label}: ${formatBytes(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value: any) =>
                                formatBytes(value as number)
                        }
                    }
                }
            }
        });
    };

    useEffect(() => {
        fetchHistoryData(timeRange);
    }, [currentEnvironment, timeRange]);

    const handleTimeRangeChange = (hours: number) => {
        setTimeRange(hours);
    };

    const handleTakeSnapshot = async () => {
        if (!currentEnvironment) return;

        try {
            await takeSnapshot(currentEnvironment);
            showToast('Snapshot taken successfully', 'success');
            fetchHistoryData(timeRange);
        } catch (error) {
            showToast('Failed to take snapshot', 'error');
        }
    };

    return (
        <>
            {/* Memory Usage Chart */}
            <div className="charts-section">
                <div className="chart-header">
                    <h3>Memory Usage Trend</h3>
                    <div className="time-range-selector">
                        {[1, 6, 24, 168, 720].map((hours) => (
                            <button
                                key={hours}
                                className={`time-range-btn ${timeRange === hours ? 'active' : ''}`}
                                onClick={() => handleTimeRangeChange(hours)}
                            >
                                {hours === 1
                                    ? '1H'
                                    : hours === 6
                                      ? '6H'
                                      : hours === 24
                                        ? '24H'
                                        : hours === 168
                                          ? '7D'
                                          : '30D'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="chart-container">
                    <canvas id="memoryChart"></canvas>
                    {isLoading && (
                        <div
                            className="loading-overlay"
                            id="memory-chart-loading"
                        >
                            Loading chart data...
                        </div>
                    )}
                </div>
            </div>

            {/* Keys Count Chart */}
            <div className="charts-section">
                <div className="chart-header">
                    <h3>Total Keys Trend</h3>
                </div>
                <div className="chart-container">
                    <canvas id="keysChart"></canvas>
                    {isLoading && (
                        <div
                            className="loading-overlay"
                            id="keys-chart-loading"
                        >
                            Loading chart data...
                        </div>
                    )}
                </div>
            </div>

            {/* Hit Rate Chart */}
            <div className="charts-section">
                <div className="chart-header">
                    <h3>Cache Hit Rate</h3>
                </div>
                <div className="chart-container">
                    <canvas id="hitRateChart"></canvas>
                    {isLoading && (
                        <div
                            className="loading-overlay"
                            id="hitrate-chart-loading"
                        >
                            Loading chart data...
                        </div>
                    )}
                </div>
            </div>

            {/* Operations Per Second Chart */}
            <div className="charts-section">
                <div className="chart-header">
                    <h3>Operations Per Second</h3>
                </div>
                <div className="chart-container">
                    <canvas id="opsChart"></canvas>
                    {isLoading && (
                        <div className="loading-overlay" id="ops-chart-loading">
                            Loading chart data...
                        </div>
                    )}
                </div>
            </div>

            {/* Network I/O Chart */}
            <div className="charts-section">
                <div className="chart-header">
                    <h3>Network I/O (MB)</h3>
                    <button
                        onClick={handleTakeSnapshot}
                        className="secondary-btn"
                    >
                        📸 Take Snapshot
                    </button>
                </div>
                <div className="chart-container">
                    <canvas id="networkChart"></canvas>
                    {isLoading && (
                        <div
                            className="loading-overlay"
                            id="network-chart-loading"
                        >
                            Loading chart data...
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
