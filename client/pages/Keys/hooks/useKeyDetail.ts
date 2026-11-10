import { useCallback, useEffect, useState } from 'react';
import { getKeyDetails, getKeyInfo } from '@/services/apiService';
import type { KeyDetails, KeyInfo } from '@/types';

interface State {
    details: KeyDetails | null;
    info: KeyInfo | null;
    loading: boolean;
    error: string | null;
}

const IDLE: State = { details: null, info: null, loading: false, error: null };

/** Loads value + metadata for the selected key; `reload` re-reads both. */
export function useKeyDetail(env: string | null, key: string | null) {
    const [state, setState] = useState<State>(IDLE);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!env || !key) {
            setState(IDLE);
            return;
        }
        let stale = false;
        setState((s) => ({ ...s, loading: true, error: null }));
        // Meta is best effort: the value still shows if it fails.
        const info = getKeyInfo(key, env).catch(() => null);
        getKeyDetails(key, env)
            .then(async (details) => {
                const meta = await info;
                if (!stale) {
                    setState({
                        details,
                        info: meta,
                        loading: false,
                        error: null
                    });
                }
            })
            .catch((e: unknown) => {
                if (!stale) {
                    setState({
                        ...IDLE,
                        error: e instanceof Error ? e.message : String(e)
                    });
                }
            });
        return () => {
            stale = true;
        };
    }, [env, key, tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { ...state, reload };
}
