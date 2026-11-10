import { useCallback, useEffect, useRef, useState } from 'react';
import { searchKeys } from '@/services/apiService';
import type { KeyMeta, ScanStats, TtlFilter } from '@/types';

const PAGE_SIZE = 100;

export interface KeysQuery {
    pattern: string;
    type: string;
    ttl: TtlFilter;
}

interface State {
    keys: string[];
    meta: Record<string, KeyMeta>;
    cursors: string[];
    hasMore: boolean;
    loading: boolean;
    error: string | null;
    /** Cumulative over the pages loaded for the current query. */
    scan: ScanStats;
    /** Bumped on every fresh search so the list can reset its scroll. */
    generation: number;
}

const EMPTY_SCAN: ScanStats = { iterations: 0, returned: 0, matched: 0, ms: 0 };

const INITIAL: State = {
    keys: [],
    meta: {},
    cursors: ['0'],
    hasMore: false,
    loading: false,
    error: null,
    scan: EMPTY_SCAN,
    generation: 0
};

/** Loads keys for a connection + query; `loadMore` continues from the cursors. */
export function useKeysQuery(env: string | null, query: KeysQuery) {
    const [state, setState] = useState<State>(INITIAL);
    const abort = useRef<AbortController | null>(null);
    const latest = useRef(state);
    latest.current = state;

    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (!env) return;
            abort.current?.abort();
            const ctl = new AbortController();
            abort.current = ctl;
            const base = reset ? INITIAL : latest.current;
            setState((s) => ({
                ...(reset ? { ...INITIAL, generation: s.generation + 1 } : s),
                loading: true,
                error: null
            }));
            try {
                const res = await searchKeys(
                    query.pattern || '*',
                    base.cursors,
                    PAGE_SIZE,
                    env,
                    ctl.signal,
                    { type: query.type, ttl: query.ttl }
                );
                if (ctl.signal.aborted) return;
                setState((s) => ({
                    ...s,
                    keys: reset ? res.keys : [...s.keys, ...res.keys],
                    meta: { ...(reset ? {} : s.meta), ...(res.meta ?? {}) },
                    cursors: res.cursors,
                    hasMore: res.hasMore,
                    loading: false,
                    scan: {
                        iterations:
                            (reset ? 0 : s.scan.iterations) +
                            (res.scan?.iterations ?? 0),
                        returned:
                            (reset ? 0 : s.scan.returned) +
                            (res.scan?.returned ?? res.keys.length),
                        matched: (reset ? 0 : s.scan.matched) + res.keys.length,
                        ms: (reset ? 0 : s.scan.ms) + (res.scan?.ms ?? 0)
                    }
                }));
            } catch (e) {
                if (ctl.signal.aborted) return;
                setState((s) => ({
                    ...s,
                    loading: false,
                    error: e instanceof Error ? e.message : String(e)
                }));
            }
        },
        [env, query.pattern, query.type, query.ttl]
    );

    // Fresh search whenever the connection or the query changes.
    useEffect(() => {
        void fetchPage(true);
        return () => abort.current?.abort();
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (latest.current.hasMore && !latest.current.loading) {
            void fetchPage(false);
        }
    }, [fetchPage]);

    const reload = useCallback(() => void fetchPage(true), [fetchPage]);

    return { ...state, loadMore, reload };
}
