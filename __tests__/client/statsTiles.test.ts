import {
    buildTiles,
    historyToSamples,
    realtimeToSample,
    tileState
} from '@/pages/Statistics/tiles';
import type { HistoryDataPoint, RealtimeStats } from '@/types';

const point = (o: Partial<HistoryDataPoint> & Record<string, number>) =>
    ({
        timestamp: 0,
        memory_used: 0,
        memory_peak: 0,
        total_keys: 0,
        keyspace_hits: 0,
        keyspace_misses: 0,
        instantaneous_ops_per_sec: 0,
        total_net_input_bytes: 0,
        total_net_output_bytes: 0,
        connected_clients: 0,
        used_cpu_sys: 0,
        used_cpu_user: 0,
        ...o
    }) as HistoryDataPoint;

describe('tileState', () => {
    test('hit rate below 90 warns, below 75 is critical', () => {
        expect(tileState(95, { warn: 90, crit: 75, below: true })).toBe('ok');
        expect(tileState(89.9, { warn: 90, crit: 75, below: true })).toBe(
            'warn'
        );
        expect(tileState(74, { warn: 90, crit: 75, below: true })).toBe('crit');
    });
    test('tiles without thresholds are always ok', () => {
        expect(tileState(0, undefined)).toBe('ok');
    });
});

describe('buildTiles', () => {
    const history = [
        point({
            timestamp: 100,
            memory_used: 1000,
            keyspace_hits: 80,
            keyspace_misses: 20,
            instantaneous_ops_per_sec: 5,
            connected_clients: 2,
            total_keys: 10,
            used_cpu_sys: 1,
            used_cpu_user: 1
        }),
        point({
            timestamp: 110,
            memory_used: 2000,
            keyspace_hits: 60,
            keyspace_misses: 40,
            instantaneous_ops_per_sec: 9,
            connected_clients: 3,
            total_keys: 12,
            used_cpu_sys: 1.5,
            used_cpu_user: 1.5
        })
    ];

    test('produces the six tiles in order', () => {
        const tiles = buildTiles(historyToSamples(history));
        expect(tiles.map((t) => t.id)).toEqual([
            'ops',
            'mem',
            'hit',
            'clients',
            'cpu',
            'keys'
        ]);
    });

    test('values come from the last sample, series from all samples', () => {
        const t = Object.fromEntries(
            buildTiles(historyToSamples(history)).map((x) => [x.id, x])
        );
        expect(t.ops.value).toBe(9);
        expect(t.ops.series).toEqual([5, 9]);
        expect(t.mem.value).toBe(2000);
        expect(t.clients.value).toBe(3);
        expect(t.keys.value).toBe(12);
        expect(t.hit.series).toEqual([80, 60]);
        expect(t.hit.state).toBe('crit');
    });

    test('cpu percent is cpu-seconds delta over wall-clock delta', () => {
        const t = buildTiles(historyToSamples(history)).find(
            (x) => x.id === 'cpu'
        )!;
        // (3 - 2) cpu-seconds over 10 s = 10 %
        expect(t.value).toBeCloseTo(10);
        expect(t.series).toEqual([0, 10]);
    });

    test('hit rate with no traffic is 100 (not a false alarm)', () => {
        const t = buildTiles(historyToSamples([point({ timestamp: 1 })])).find(
            (x) => x.id === 'hit'
        )!;
        expect(t.value).toBe(100);
        expect(t.state).toBe('ok');
    });

    test('empty history yields tiles with no value', () => {
        const t = buildTiles([]);
        expect(t).toHaveLength(6);
        expect(t[0].value).toBeNull();
    });
});

describe('realtimeToSample', () => {
    test('maps a realtime payload so the tail tile values update', () => {
        const rt = {
            memory: { used: 5000 },
            stats: {
                keyspace_hits: 9,
                keyspace_misses: 1,
                ops_per_sec: 77
            },
            clients: { connected: 4 },
            cpu: { used_cpu_sys: 2, used_cpu_user: 3 },
            keyspace: { db0: 'keys=30,expires=2,avg_ttl=0' }
        } as unknown as RealtimeStats;
        const base = historyToSamples([point({ timestamp: 100 })]);
        const live = realtimeToSample(rt, 200);
        const tiles = buildTiles([...base, live]);
        const get = (id: string) => tiles.find((x) => x.id === id)!;
        expect(get('ops').value).toBe(77);
        expect(get('mem').value).toBe(5000);
        expect(get('hit').value).toBe(90);
        expect(get('clients').value).toBe(4);
        expect(get('keys').value).toBe(30);
        expect(get('ops').series).toHaveLength(2);
    });
});
