import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHistoryStats, getRealtimeStats } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { HistoryDataPoint, RealtimeStats } from '@/types';
import {
    buildTiles,
    historyToSamples,
    realtimeToSample,
    type Tile
} from './tiles';

export const LIVE_INTERVAL_MS = 10_000;

interface StatsData {
    history: HistoryDataPoint[];
    tiles: Tile[];
    loadingHistory: boolean;
}

/**
 * History comes from /history once per range; the live poll replaces only the
 * tail sample (tile values and sparkline end), never the history itself.
 */
export function useStatsData(
    env: string | null,
    hours: number,
    live: boolean
): StatsData {
    const { showToast } = useToast();
    const [loaded, setLoaded] = useState<{
        key: string;
        data: HistoryDataPoint[];
    } | null>(null);
    const [realtime, setRealtime] = useState<{
        env: string;
        stats: RealtimeStats;
        ts: number;
    } | null>(null);
    const historyKey = `${env ?? ''}:${String(hours)}`;

    useEffect(() => {
        if (!env) return;
        let cancelled = false;
        getHistoryStats(env, hours)
            .then((res) => {
                if (!cancelled) {
                    setLoaded({
                        key: `${env}:${String(hours)}`,
                        data: res.data
                    });
                }
            })
            .catch((error: unknown) => {
                showToast('Failed to load statistics history', 'error');
                console.error('Error loading history:', error);
            });
        return () => {
            cancelled = true;
        };
    }, [env, hours, showToast]);

    const poll = useCallback(
        (isCancelled: () => boolean) => {
            if (!env) return;
            getRealtimeStats(env)
                .then((stats) => {
                    if (!isCancelled()) {
                        setRealtime({
                            env,
                            stats,
                            ts: Math.floor(Date.now() / 1000)
                        });
                    }
                })
                .catch((error: unknown) => {
                    console.error('Error loading realtime stats:', error);
                });
        },
        [env]
    );

    // One fetch per connection; pausing must not trigger another.
    useEffect(() => {
        let cancelled = false;
        poll(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [poll]);

    useEffect(() => {
        if (!live) return;
        let cancelled = false;
        const timer = setInterval(() => {
            poll(() => cancelled);
        }, LIVE_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [live, poll]);

    const history = useMemo(
        () => (loaded?.key === historyKey ? loaded.data : []),
        [loaded, historyKey]
    );
    const loadingHistory = !!env && loaded?.key !== historyKey;

    const tiles = useMemo(() => {
        const samples = historyToSamples(history);
        if (realtime && realtime.env === env) {
            samples.push(realtimeToSample(realtime.stats, realtime.ts));
        }
        return buildTiles(samples);
    }, [history, realtime, env]);

    return { history, tiles, loadingHistory };
}
