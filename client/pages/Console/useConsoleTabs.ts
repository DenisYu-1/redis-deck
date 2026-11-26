import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { activeTab, blankTab, patchTab, readTabs } from './tabs';

export type { ConsoleTab } from './tabs';

/**
 * The Console's editor tabs, kept in localStorage. There is always at least one.
 */
export function useConsoleTabs() {
    const stored = useAppStore((s) => s.consoleTabs);
    const update = useAppStore((s) => s.updateConsoleTabs);
    const state = useMemo(() => stored ?? readTabs(), [stored]);
    const { tabs } = state;
    const active = activeTab(state);

    const select = (id: number) => update((s) => ({ ...s, activeId: id }));

    const add = () =>
        update((s) => {
            const tab = blankTab(s.tabs);
            return { tabs: [...s.tabs, tab], activeId: tab.id };
        });

    /** Closes the tab, unless it is the only one. */
    const close = (id: number) =>
        update((s) => {
            const [first, ...rest] = s.tabs.filter((t) => t.id !== id);
            if (!first) return s;
            return {
                tabs: [first, ...rest],
                activeId: s.activeId === id ? first.id : s.activeId
            };
        });

    const rename = (id: number, name: string) =>
        update((s) => patchTab(s, id, { name }));
    const setScript = (script: string) =>
        update((s) => patchTab(s, active.id, { script }));

    return { tabs, active, select, add, close, rename, setScript };
}
