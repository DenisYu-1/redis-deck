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
        <div className="charts-section">
            <div className="chart-header">
                <h3>Memory Usage by Key Pattern</h3>
                <div
                    style={{
                        display: 'flex',
                        gap: '15px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}
                >
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.9em',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <span>Sample:</span>
                        <select
                            id="sample-size-select"
                            value={sampleSize}
                            onChange={(e) =>
                                setSampleSize(parseInt(e.target.value, 10))
                            }
                            style={{
                                padding: '4px 8px',
                                border: '1px solid var(--border-secondary)',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <option value="100">100 keys</option>
                            <option value="200">200 keys</option>
                            <option value="500">500 keys</option>
                            <option value="1000">1000 keys</option>
                        </select>
                    </label>
                    <span
                        style={{
                            fontSize: '0.9em',
                            color: 'var(--text-secondary)'
                        }}
                        id="pattern-analysis-info"
                    >
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
                <div
                    id="pattern-analysis-results"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '30px',
                        marginBottom: '20px'
                    }}
                >
                    <div>
                        <h4
                            style={{
                                marginBottom: '15px',
                                color: 'var(--text-heading)'
                            }}
                        >
                            Distribution
                        </h4>
                        <div style={{ position: 'relative', height: '300px' }}>
                            <canvas id="patternPieChart"></canvas>
                        </div>
                    </div>
                    <div>
                        <h4
                            style={{
                                marginBottom: '15px',
                                color: 'var(--text-heading)'
                            }}
                        >
                            Top Patterns by {fastMode ? 'Count' : 'Memory'}
                        </h4>
                        <div
                            id="pattern-summary"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}
                        >
                            {data.patterns
                                .slice(0, 10)
                                .map((pattern, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 12px',
                                            backgroundColor:
                                                'var(--bg-tertiary)',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <span style={{ fontWeight: '500' }}>
                                            {pattern.pattern}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '0.9em',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {fastMode
                                                ? `${formatNumber(pattern.count)} keys`
                                                : formatBytes(
                                                      pattern.total_memory
                                                  )}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {data && data.patterns.length > 0 ? (
                <div style={{ overflowX: 'auto', marginTop: '20px' }}>
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
                                    Pattern
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        borderBottom:
                                            '2px solid var(--border-primary)'
                                    }}
                                >
                                    Key Count
                                </th>
                                {!fastMode && (
                                    <th
                                        style={{
                                            padding: '12px',
                                            borderBottom:
                                                '2px solid var(--border-primary)'
                                        }}
                                    >
                                        Total Memory
                                    </th>
                                )}
                                {!fastMode && (
                                    <th
                                        style={{
                                            padding: '12px',
                                            borderBottom:
                                                '2px solid var(--border-primary)'
                                        }}
                                    >
                                        Avg per Key
                                    </th>
                                )}
                                {!fastMode && (
                                    <th
                                        style={{
                                            padding: '12px',
                                            borderBottom:
                                                '2px solid var(--border-primary)'
                                        }}
                                    >
                                        % of Total
                                    </th>
                                )}
                                <th
                                    style={{
                                        padding: '12px',
                                        borderBottom:
                                            '2px solid var(--border-primary)'
                                    }}
                                >
                                    Sample Keys
                                </th>
                            </tr>
                        </thead>
                        <tbody id="pattern-table">
                            {data.patterns.map((pattern, index) => (
                                <tr
                                    key={index}
                                    style={{
                                        borderBottom:
                                            index < data.patterns.length - 1
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
                                            {pattern.pattern}
                                        </code>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {formatNumber(pattern.count)}
                                    </td>
                                    {!fastMode && (
                                        <td style={{ padding: '12px' }}>
                                            {formatBytes(pattern.total_memory)}
                                        </td>
                                    )}
                                    {!fastMode && (
                                        <td style={{ padding: '12px' }}>
                                            {formatBytes(pattern.avg_memory)}
                                        </td>
                                    )}
                                    {!fastMode && (
                                        <td style={{ padding: '12px' }}>
                                            {pattern.percentage}%
                                        </td>
                                    )}
                                    <td style={{ padding: '12px' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '4px'
                                            }}
                                        >
                                            {pattern.sample_keys.map(
                                                (key, keyIndex) => (
                                                    <code
                                                        key={keyIndex}
                                                        style={{
                                                            backgroundColor:
                                                                'var(--bg-tertiary)',
                                                            padding: '1px 4px',
                                                            borderRadius: '2px',
                                                            fontFamily:
                                                                'monospace',
                                                            fontSize: '0.8em',
                                                            maxWidth: '120px',
                                                            overflow: 'hidden',
                                                            textOverflow:
                                                                'ellipsis'
                                                        }}
                                                    >
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
                <div
                    id="pattern-analysis-loading"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: '2em', marginBottom: '10px' }}>
                        ⏳
                    </div>
                    <div id="analysis-status">
                        {fastMode
                            ? 'Analyzing key patterns...'
                            : 'Analyzing memory usage...'}
                    </div>
                    <div style={{ fontSize: '0.9em', marginTop: '10px' }}>
                        This may take a moment for large datasets
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <div
                            style={{
                                width: '300px',
                                height: '6px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                id="analysis-progress-bar"
                                style={{
                                    height: '100%',
                                    background: 'var(--accent-primary)',
                                    width: isLoading ? '50%' : '0%',
                                    transition: 'width 0.3s ease'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
