import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import { getMemoryByPattern } from '@/services/apiService';
import { formatBytes, formatNumber } from '@/utils/formatter';
import type { MemoryByPatternResponse } from '@/types';

declare global {
    interface Window {
        Chart: any;
    }
}

export function MemoryPatternAnalysis() {
    const [data, setData] = useState<MemoryByPatternResponse | null>(null);
    const [sampleSize, setSampleSize] = useState(200);
    const [fastMode, setFastMode] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [charts, setCharts] = useState<Record<string, any>>({});
    const { currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    const fetchMemoryPatterns = async (useFastMode: boolean) => {
        if (!currentEnvironment) return;

        setIsLoading(true);
        try {
            const result = await getMemoryByPattern(
                currentEnvironment,
                sampleSize,
                useFastMode
            );
            setData(result);

            if (result.patterns.length > 0) {
                updateCharts(result);
            }
        } catch (error) {
            showToast('Failed to analyze memory patterns', 'error');
            console.error('Error analyzing memory patterns:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateCharts = (result: MemoryByPatternResponse) => {
        // Pie Chart
        updatePieChart(result);

        // Clear any existing charts
        Object.values(charts).forEach((chart: any) => chart?.destroy());
        setCharts({});
    };

    const updatePieChart = (result: MemoryByPatternResponse) => {
        const ctx = (
            document.getElementById('patternPieChart') as HTMLCanvasElement
        ).getContext('2d');
        if (!ctx) return;

        const colors = [
            '#3498db',
            '#e74c3c',
            '#2ecc71',
            '#f39c12',
            '#9b59b6',
            '#1abc9c',
            '#34495e',
            '#e67e22',
            '#95a5a6',
            '#f1c40f'
        ];

        const chart = new window.Chart(ctx, {
            type: 'pie',
            data: {
                labels: result.patterns.slice(0, 10).map((p) => p.pattern),
                datasets: [
                    {
                        data: result.patterns
                            .slice(0, 10)
                            .map((p) => p.total_memory || p.count),
                        backgroundColor: colors.slice(
                            0,
                            Math.min(result.patterns.length, 10)
                        ),
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => {
                                const pattern =
                                    result.patterns[context.dataIndex];
                                if (!pattern) return '';
                                const value = fastMode
                                    ? pattern.count
                                    : pattern.total_memory;
                                const label = fastMode
                                    ? `${pattern.count} keys`
                                    : formatBytes(value);
                                return `${pattern.pattern}: ${label}`;
                            }
                        }
                    }
                }
            }
        });

        setCharts((prev) => ({ ...prev, pieChart: chart }));
    };

    const handleAnalyzeCounts = () => {
        setFastMode(true);
        fetchMemoryPatterns(true);
    };

    const handleAnalyzeMemory = () => {
        setFastMode(false);
        fetchMemoryPatterns(false);
    };

    useEffect(() => {
        if (currentEnvironment) {
            fetchMemoryPatterns(true);
        }
    }, [currentEnvironment]);

    const infoText = data
        ? `Analyzed ${data.sampled_keys} keys from ${data.total_keys} total. ${fastMode ? 'Count mode' : 'Memory mode'}.`
        : 'Not analyzed yet';

    return (
        <div className="pattern-analysis-container">
            <div className="pattern-analysis-header">
                <h3>Memory Usage by Key Pattern</h3>
                <div className="pattern-controls">
                    <label className="sample-size-control">
                        <span>Sample:</span>
                        <select
                            id="sample-size-select"
                            value={sampleSize}
                            onChange={(e) =>
                                setSampleSize(parseInt(e.target.value, 10))
                            }
                        >
                            <option value="100">100 keys</option>
                            <option value="200">200 keys</option>
                            <option value="500">500 keys</option>
                            <option value="1000">1000 keys</option>
                        </select>
                    </label>
                    <span className="pattern-analysis-info" id="pattern-analysis-info">
                        {infoText}
                    </span>
                    <button
                        onClick={handleAnalyzeCounts}
                        className="secondary-btn"
                        title="Fast: analyze key counts only"
                    >
                        📊 Analyze Counts
                    </button>
                    <button
                        onClick={handleAnalyzeMemory}
                        className="secondary-btn"
                        title="Calculates exact memory usage for sampled keys"
                    >
                        💾 Analyze Memory
                    </button>
                </div>
            </div>

            {data && data.patterns.length > 0 ? (
                <div id="pattern-analysis-results" className="pattern-results">
                    <div className="pattern-distribution">
                        <h4>Distribution</h4>
                        <div className="pattern-pie-container">
                            <canvas id="patternPieChart"></canvas>
                        </div>
                    </div>
                    <div className="pattern-top-keys">
                        <h4>Top Patterns by {fastMode ? 'Count' : 'Memory'}</h4>
                        <div id="pattern-summary" className="pattern-summary">
                            {data.patterns
                                .slice(0, 10)
                                .map((pattern, index) => (
                                    <div key={index} className="pattern-summary-item">
                                        <span className="pattern-name">
                                            {pattern.pattern}
                                        </span>
                                        <span className="pattern-memory">
                                            {fastMode
                                                ? `${formatNumber(pattern.count)} keys`
                                                : formatBytes(pattern.total_memory)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {data && data.patterns.length > 0 ? (
                <div className="pattern-table-container">
                    <table className="pattern-table">
                        <thead>
                            <tr>
                                <th>Pattern</th>
                                <th>Key Count</th>
                                {!fastMode && <th>Total Memory</th>}
                                {!fastMode && <th>Avg per Key</th>}
                                {!fastMode && <th>% of Total</th>}
                                <th>Sample Keys</th>
                            </tr>
                        </thead>
                        <tbody id="pattern-table">
                            {data.patterns.map((pattern, index) => (
                                <tr key={index}>
                                    <td><code>{pattern.pattern}</code></td>
                                    <td>{formatNumber(pattern.count)}</td>
                                    {!fastMode && (
                                        <td>{formatBytes(pattern.total_memory)}</td>
                                    )}
                                    {!fastMode && (
                                        <td>{formatBytes(pattern.avg_memory)}</td>
                                    )}
                                    {!fastMode && (
                                        <td>{pattern.percentage}%</td>
                                    )}
                                    <td>
                                        <div>
                                            {pattern.sample_keys.map(
                                                (key, keyIndex) => (
                                                    <code key={keyIndex}>
                                                        {key}
                                                    </code>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {isLoading && (
                <div id="pattern-analysis-loading" className="pattern-analysis-loading">
                    <div className="analysis-status">
                        {fastMode
                            ? 'Analyzing key patterns...'
                            : 'Analyzing memory usage...'}
                    </div>
                    <div className="analysis-substatus">
                        This may take a moment for large datasets
                    </div>
                    <div className="analysis-progress-container">
                        <div
                            id="analysis-progress-bar"
                            className="analysis-progress-bar"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
