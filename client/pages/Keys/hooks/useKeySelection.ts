import { useCallback, useMemo, useState } from 'react';

interface Picked {
    scope: string;
    visible: string[];
    keys: ReadonlySet<string>;
}

/**
 * Checkbox selection over the currently visible keys. The selection is cleared
 * when `scope` (connection + query) changes, and keys that leave the visible
 * list are forgotten for good. Consumed by bulk actions.
 */
export function useKeySelection(visible: string[], scope = '') {
    const [state, setState] = useState<Picked>({
        scope,
        visible,
        keys: new Set()
    });

    // Derive during render so a stale selection is never exposed, even for one frame.
    let picked = state.keys;
    if (state.scope !== scope) {
        picked = new Set();
        setState({ scope, visible, keys: picked });
    } else if (state.visible !== visible) {
        const shown = new Set(visible);
        picked = new Set([...state.keys].filter((k) => shown.has(k)));
        setState({ scope, visible, keys: picked });
    }

    const keys = useMemo(
        () => visible.filter((k) => picked.has(k)),
        [visible, picked]
    );
    const allSelected = visible.length > 0 && keys.length === visible.length;

    const update = useCallback(
        (fn: (prev: ReadonlySet<string>) => ReadonlySet<string>) =>
            setState((s) => ({ ...s, keys: fn(s.keys) })),
        []
    );

    const toggle = useCallback(
        (key: string) =>
            update((prev) => {
                const next = new Set(prev);
                if (!next.delete(key)) next.add(key);
                return next;
            }),
        [update]
    );

    const toggleAll = useCallback(
        () => update(() => (allSelected ? new Set() : new Set(visible))),
        [update, allSelected, visible]
    );

    const clear = useCallback(() => update(() => new Set()), [update]);
    const has = useCallback((key: string) => picked.has(key), [picked]);

    return {
        keys,
        count: keys.length,
        allSelected,
        toggle,
        toggleAll,
        clear,
        has
    };
}
