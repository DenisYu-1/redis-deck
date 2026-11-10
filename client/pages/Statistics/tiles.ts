import type { HistoryDataPoint, RealtimeStats } from '@/types';

/** One observation of the server, from a stored snapshot or a live poll. */
export interface Sample {
    ts: number;
    mem: number;
    hits: number;
    misses: number;
    ops: number;
    clients: number;
    /** Cumulative CPU seconds (sys + user). */
    cpuTotal: number;
    keys: number;
}

export type TileId = 'ops' | 'mem' | 'hit' | 'clients' | 'cpu' | 'keys';
export type TileState = 'ok' | 'warn' | 'crit';

export interface Thresholds {
    warn: number;
    crit: number;
    below: boolean;
}

export interface Tile {
    id: TileId;
    title: string;
    value: number | null;
    series: number[];
    state: TileState;
    threshold?: Thresholds;
}

const HIT_THRESHOLDS: Thresholds = { warn: 90, crit: 75, below: true };

export function tileState(value: number, t: Thresholds | undefined): TileState {
    if (!t) return 'ok';
    const bad = (x: number) => (t.below ? value < x : value > x);
    if (bad(t.crit)) return 'crit';
    if (bad(t.warn)) return 'warn';
    return 'ok';
}

export function historyToSamples(data: HistoryDataPoint[]): Sample[] {
    return data.map((p) => ({
        ts: p.timestamp,
        mem: p.memory_used,
        hits: p.keyspace_hits,
        misses: p.keyspace_misses,
        ops: p.instantaneous_ops_per_sec,
        clients: p.connected_clients,
        cpuTotal: (p.used_cpu_sys || 0) + (p.used_cpu_user || 0),
        keys: p.total_keys
    }));
}

function sumKeyspaceKeys(keyspace: Record<string, string>): number {
    return Object.entries(keyspace).reduce((sum, [name, v]) => {
        const m = /keys=(\d+)/.exec(v);
        return name.startsWith('db') && m
            ? sum + parseInt(m[1] ?? '0', 10)
            : sum;
    }, 0);
}

export function realtimeToSample(rt: RealtimeStats, ts: number): Sample {
    return {
        ts,
        mem: rt.memory.used,
        hits: rt.stats.keyspace_hits,
        misses: rt.stats.keyspace_misses,
        ops: rt.stats.ops_per_sec,
        clients: rt.clients.connected,
        cpuTotal: rt.cpu.used_cpu_sys + rt.cpu.used_cpu_user,
        keys: sumKeyspaceKeys(rt.keyspace)
    };
}

function hitRate(s: Sample): number {
    const total = s.hits + s.misses;
    return total > 0 ? (s.hits / total) * 100 : 100;
}

function cpuSeries(samples: Sample[]): number[] {
    return samples.map((s, i) => {
        if (i === 0) return 0;
        const prev = samples[i - 1];
        if (!prev) return 0;
        const dt = s.ts - prev.ts;
        const dc = s.cpuTotal - prev.cpuTotal;
        return dt > 0 && dc >= 0 ? (dc / dt) * 100 : 0;
    });
}

export function buildTiles(samples: Sample[]): Tile[] {
    const make = (
        id: TileId,
        title: string,
        series: number[],
        threshold?: Thresholds
    ): Tile => {
        const th = threshold ? { threshold } : {};
        const value = series.length
            ? (series[series.length - 1] ?? null)
            : null;
        return {
            id,
            title,
            value,
            series,
            ...th,
            state: value === null ? 'ok' : tileState(value, threshold)
        };
    };
    return [
        make(
            'ops',
            'Ops/sec',
            samples.map((s) => s.ops)
        ),
        make(
            'mem',
            'Memory',
            samples.map((s) => s.mem)
        ),
        make('hit', 'Hit rate', samples.map(hitRate), HIT_THRESHOLDS),
        make(
            'clients',
            'Clients',
            samples.map((s) => s.clients)
        ),
        make('cpu', 'CPU', cpuSeries(samples)),
        make(
            'keys',
            'Keys',
            samples.map((s) => s.keys)
        )
    ];
}
