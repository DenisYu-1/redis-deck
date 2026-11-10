import type { ReactNode } from 'react';
import type { HistoryDataPoint } from '@/types';
import {
    HitRateChart,
    KeyspaceChart,
    MemoryChart,
    OpsChart
} from './components/charts';
import { CommandStatsTable } from './components/CommandStatsTable';
import { MemoryPatternAnalysis } from './components/MemoryPatternAnalysis';
import { SlowLogTable } from './components/SlowLogTable';
import { StatTile } from './StatTile';
import type { WidgetId } from './boards';
import type { Tile, TileId } from './tiles';

export interface WidgetData {
    history: HistoryDataPoint[];
    hours: number;
    loading: boolean;
    tiles: Tile[];
    tileIds: TileId[] | undefined;
}

export function renderWidget(id: WidgetId, d: WidgetData): ReactNode {
    const chart = { data: d.history, hours: d.hours, loading: d.loading };
    switch (id) {
        case 'tiles':
            return (
                <div className="tiles">
                    {d.tiles
                        .filter((t) => !d.tileIds || d.tileIds.includes(t.id))
                        .map((t) => (
                            <StatTile key={t.id} tile={t} />
                        ))}
                </div>
            );
        case 'chart-memory':
            return <MemoryChart {...chart} />;
        case 'chart-keyspace':
            return <KeyspaceChart {...chart} />;
        case 'chart-hitrate':
            return <HitRateChart {...chart} />;
        case 'chart-ops':
            return <OpsChart {...chart} />;
        case 'commands':
            return <CommandStatsTable />;
        case 'slowlog':
            return <SlowLogTable />;
        case 'patterns':
            return <MemoryPatternAnalysis />;
    }
}
