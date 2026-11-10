import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import type { Plugin } from 'chart.js';
import { formatBytes } from '@/utils/formatter';
import type { HistoryDataPoint } from '@/types';

interface ChartsSectionProps {
    data: HistoryDataPoint[];
    hours: number;
    loading: boolean;
}

interface SeriesDef {
    label: string;
    values: number[];
    color: string;
    dashed?: boolean;
}

const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

/** Vertical line under the pointer, drawn from the tooltip's active point. */
const crosshair: Plugin<'line'> = {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
        const active = chart.tooltip?.getActiveElements();
        if (!active?.length) return;
        const { ctx, chartArea } = chart;
        const x = active[0]?.element.x ?? 0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = cssVar('--bd2', '#888');
        ctx.stroke();
        ctx.restore();
    }
};

function formatTick(ts: number, hours: number): string {
    const d = new Date(ts * 1000);
    return hours > 24
        ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
              ' ' +
              d.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
              })
        : d.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit'
          });
}

function LineChart({
    id,
    title,
    data,
    hours,
    loading,
    series,
    format
}: {
    id: string;
    title: string;
    data: HistoryDataPoint[];
    hours: number;
    loading: boolean;
    series: (d: HistoryDataPoint[]) => SeriesDef[];
    format: (v: number) => string;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const el = canvas.current;
        if (!el || !data.length) return;
        const ctx = el.getContext('2d');
        if (!ctx) return;
        const text = cssVar('--mu', '#888');
        const grid = cssVar('--grid', '#333');
        const chart = new Chart(ctx, {
            type: 'line',
            plugins: [crosshair],
            data: {
                labels: data.map((p) => formatTick(p.timestamp, hours)),
                datasets: series(data).map((s) => ({
                    label: s.label,
                    data: s.values,
                    borderColor: s.color,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderDash: s.dashed ? [5, 4] : [],
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    tension: 0.25
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { color: text, boxWidth: 10, boxHeight: 2 }
                    },
                    tooltip: {
                        backgroundColor: cssVar('--sf', '#222'),
                        titleColor: cssVar('--tx', '#fff'),
                        bodyColor: cssVar('--tx2', '#ddd'),
                        borderColor: cssVar('--bd2', '#444'),
                        borderWidth: 1,
                        callbacks: {
                            label: (c) =>
                                `${c.dataset.label ?? ''}: ${format(c.parsed.y ?? 0)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: text, maxTicksLimit: 6 },
                        grid: { color: grid }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: text, callback: (v) => format(+v) },
                        grid: { color: grid }
                    }
                }
            }
        });
        return () => chart.destroy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, hours]);

    return (
        <div className="charts-section" data-testid={`chart-${id}`}>
            <div className="chart-header">
                <h3>{title}</h3>
            </div>
            <div className="chart-container">
                <canvas ref={canvas} />
                {loading && <div className="loading-overlay">Loading…</div>}
                {!loading && !data.length && (
                    <div className="loading-overlay">
                        No snapshots in this range yet
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChartsSection({ data, hours, loading }: ChartsSectionProps) {
    const c1 = cssVar('--c1', '#4a8ae8');
    const c2 = cssVar('--c2', '#da7232');
    const ok = cssVar('--ok', '#4ade80');
    const props = { data, hours, loading };
    return (
        <>
            <div className="wrow">
                <LineChart
                    {...props}
                    id="memory"
                    title="Memory usage"
                    format={formatBytes}
                    series={(d) => [
                        {
                            label: 'Used',
                            values: d.map((p) => p.memory_used),
                            color: c1
                        },
                        {
                            label: 'Peak',
                            values: d.map((p) => p.memory_peak),
                            color: c2,
                            dashed: true
                        }
                    ]}
                />
                <LineChart
                    {...props}
                    id="keyspace"
                    title="Keyspace"
                    format={(v) => Math.round(v).toLocaleString()}
                    series={(d) => [
                        {
                            label: 'Keys',
                            values: d.map((p) => p.total_keys),
                            color: ok
                        }
                    ]}
                />
            </div>
            <div className="wrow">
                <LineChart
                    {...props}
                    id="hitrate"
                    title="Hit rate"
                    format={(v) => `${v.toFixed(1)}%`}
                    series={(d) => [
                        {
                            label: 'Hit rate',
                            values: d.map((p) => {
                                const t = p.keyspace_hits + p.keyspace_misses;
                                return t > 0
                                    ? (p.keyspace_hits / t) * 100
                                    : 100;
                            }),
                            color: c1
                        }
                    ]}
                />
                <LineChart
                    {...props}
                    id="ops"
                    title="Operations/sec"
                    format={(v) => Math.round(v).toLocaleString()}
                    series={(d) => [
                        {
                            label: 'Ops/sec',
                            values: d.map((p) => p.instantaneous_ops_per_sec),
                            color: c2
                        }
                    ]}
                />
            </div>
        </>
    );
}
