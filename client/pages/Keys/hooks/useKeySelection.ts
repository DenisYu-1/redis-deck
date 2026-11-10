import { useCallback, useMemo, useState } from 'react';

/**
 * Checkbox selection over the currently visible keys. Selected keys that fall
 * out of view (new search, filter) are dropped. Consumed by bulk actions.
 */
export function useKeySelection(visible: string[]) {
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

    const keys = useMemo(
        () => visible.filter((k) => picked.has(k)),
        [visible, picked]
    );
    const allSelected = visible.length > 0 && keys.length === visible.length;

    const toggle = useCallback((key: string) => {
        setPicked((prev) => {
            const next = new Set(prev);
            if (!next.delete(key)) next.add(key);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        setPicked(allSelected ? new Set() : new Set(visible));
    }, [allSelected, visible]);

    const clear = useCallback(() => setPicked(new Set()), []);
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
