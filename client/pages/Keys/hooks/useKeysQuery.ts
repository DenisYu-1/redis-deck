import { useCallback, useEffect, useRef, useState } from 'react';
import { searchKeys } from '@/services/apiService';
import type { FailedNode, KeyMeta, ScanStats, TtlFilter } from '@/types';

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
    /** Nodes that failed on the latest page; Load more retries them. */
    failedNodes: FailedNode[];
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
    failedNodes: [],
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
            // Each request stops at the server's time budget (SPEC R5): keep
            // continuing until the page fills, the scan ends, a Node fails or
            // the user stops. State was reset above, so always accumulate.
            let cursors = base.cursors;
            let added = 0;
            try {
                for (;;) {
                    const res = await searchKeys(
                        query.pattern || '*',
                        cursors,
                        PAGE_SIZE - added,
                        env,
                        ctl.signal,
                        { type: query.type, ttl: query.ttl }
                    );
                    if (ctl.signal.aborted) return;
                    cursors = res.cursors;
                    added += res.keys.length;
                    const failedNodes = res.failedNodes ?? [];
                    const done =
                        !res.hasMore ||
                        added >= PAGE_SIZE ||
                        failedNodes.length > 0;
                    setState((s) => ({
                        ...s,
                        keys: [...s.keys, ...res.keys],
                        meta: { ...s.meta, ...(res.meta ?? {}) },
                        cursors: res.cursors,
                        hasMore: res.hasMore,
                        failedNodes,
                        loading: !done,
                        scan: {
                            iterations:
                                s.scan.iterations + (res.scan?.iterations ?? 0),
                            returned:
                                s.scan.returned +
                                (res.scan?.returned ?? res.keys.length),
                            matched: s.scan.matched + res.keys.length,
                            ms: s.scan.ms + (res.scan?.ms ?? 0)
                        }
                    }));
                    if (done) return;
                }
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

    /** Stops an in-progress search; Load more resumes from the last cursors. */
    const stop = useCallback(() => {
        abort.current?.abort();
        setState((s) => ({ ...s, loading: false }));
    }, []);

    return { ...state, loadMore, reload, stop };
}
