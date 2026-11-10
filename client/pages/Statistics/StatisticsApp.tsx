import { useState } from 'react';
import { ChartsSection } from './components/ChartsSection';
import { CommandStatsTable } from './components/CommandStatsTable';
import { SlowLogTable } from './components/SlowLogTable';
import { MemoryPatternAnalysis } from './components/MemoryPatternAnalysis';
import { StatTile } from './StatTile';
import { useStatsData } from './useStatsData';
import { useAppStore } from '@/store/useAppStore';
import './statistics.css';

const RANGES = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 },
    { label: '30d', hours: 720 }
];

export function StatisticsApp() {
    const { currentEnvironment } = useAppStore();
    const [hours, setHours] = useState(24);
    const [live, setLive] = useState(true);
    const { history, tiles, loadingHistory } = useStatsData(
        currentEnvironment,
        hours,
        live
    );

    return (
        <div className="stats-page">
            <div className="viewhead">
                <div className="titles">
                    <h1>Overview</h1>
                    <span className="mono xs mu">
                        Snapshots every 5 min · 30-day retention
                        {currentEnvironment ? ` · ${currentEnvironment}` : ''}
                    </span>
                </div>
                <div className="segs" role="group" aria-label="Time range">
                    {RANGES.map((r) => (
                        <button
                            key={r.label}
                            type="button"
                            aria-pressed={r.hours === hours}
                            onClick={() => setHours(r.hours)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={`btn live ${live ? '' : 'off'}`}
                    aria-pressed={live}
                    onClick={() => setLive((v) => !v)}
                >
                    <i />
                    {live ? 'Live' : 'Paused'}
                </button>
            </div>
            <div className="board">
                <div className="tiles">
                    {tiles.map((t) => (
                        <StatTile key={t.id} tile={t} />
                    ))}
                </div>
                <ChartsSection
                    data={history}
                    hours={hours}
                    loading={loadingHistory}
                />
                <div className="wrow">
                    <CommandStatsTable />
                    <SlowLogTable />
                </div>
                <div className="wrow">
                    <MemoryPatternAnalysis />
                </div>
            </div>
        </div>
    );
}
