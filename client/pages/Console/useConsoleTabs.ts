import { useEffect, useState } from 'react';

const KEY = 'redisdeck-console-tabs';

export interface ConsoleTab {
    id: number;
    name: string;
    script: string;
}

interface Tabs {
    /** Never empty. */
    tabs: [ConsoleTab, ...ConsoleTab[]];
    activeId: number;
}

/** A new tab numbered after the highest `console-N.redis` and id in use. */
function blankTab(tabs: ConsoleTab[]): ConsoleTab {
    const numbers = tabs.map((t) =>
        Number(/^console-(\d+)\.redis$/.exec(t.name)?.[1] ?? 0)
    );
    return {
        id: Math.max(0, ...tabs.map((t) => t.id)) + 1,
        name: `console-${Math.max(0, ...numbers) + 1}.redis`,
        script: ''
    };
}

const isTab = (v: unknown): v is ConsoleTab => {
    const t = v as Partial<ConsoleTab> | null;
    return (
        typeof t?.id === 'number' &&
        typeof t.name === 'string' &&
        typeof t.script === 'string'
    );
};

/** The stored tabs, or one blank tab when there are none to read. */
function initial(): Tabs {
    try {
        const v = JSON.parse(
            localStorage.getItem(KEY) ?? 'null'
        ) as Tabs | null;
        if (v && Array.isArray(v.tabs) && v.tabs.length && v.tabs.every(isTab))
            return v;
    } catch {
        // storage unavailable or not JSON: start fresh
    }
    const first = blankTab([]);
    return { tabs: [first], activeId: first.id };
}

/**
 * The Console's editor tabs, kept in localStorage. There is always at least one.
 */
export function useConsoleTabs() {
    const [state, setState] = useState(initial);
    const { tabs, activeId } = state;
    const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

    useEffect(() => {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch {
            // storage blocked or full: tabs last until the page is left
        }
    }, [state]);

    const select = (id: number) => setState((s) => ({ ...s, activeId: id }));

    const add = () =>
        setState((s) => {
            const tab = blankTab(s.tabs);
            return { tabs: [...s.tabs, tab], activeId: tab.id };
        });

    /** Closes the tab, unless it is the only one. */
    const close = (id: number) =>
        setState((s) => {
            const [first, ...rest] = s.tabs.filter((t) => t.id !== id);
            if (!first) return s;
            return {
                tabs: [first, ...rest],
                activeId: s.activeId === id ? first.id : s.activeId
            };
        });

    const patch = (id: number, change: Partial<ConsoleTab>) =>
        setState((s) => {
            const apply = (t: ConsoleTab) =>
                t.id === id ? { ...t, ...change } : t;
            const [first, ...rest] = s.tabs;
            return { ...s, tabs: [apply(first), ...rest.map(apply)] };
        });

    const rename = (id: number, name: string) => patch(id, { name });
    const setScript = (script: string) => patch(active.id, { script });

    return { tabs, active, select, add, close, rename, setScript };
}
