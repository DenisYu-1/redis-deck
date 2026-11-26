// The Console's editor tabs as data, and where they are kept.
const KEY = 'redisdeck-console-tabs';

export interface ConsoleTab {
    id: number;
    name: string;
    script: string;
}

export interface Tabs {
    /** Never empty. */
    tabs: [ConsoleTab, ...ConsoleTab[]];
    activeId: number;
}

/** A new tab numbered after the highest `console-N.redis` and id in use. */
export function blankTab(tabs: ConsoleTab[]): ConsoleTab {
    const numbers = tabs.map((t) =>
        Number(/^console-(\d+)\.redis$/.exec(t.name)?.[1] ?? 0)
    );
    return {
        id: Math.max(0, ...tabs.map((t) => t.id)) + 1,
        name: `console-${Math.max(0, ...numbers) + 1}.redis`,
        script: ''
    };
}

export const activeTab = ({ tabs, activeId }: Tabs): ConsoleTab =>
    tabs.find((t) => t.id === activeId) ?? tabs[0];

export function patchTab(
    state: Tabs,
    id: number,
    change: Partial<ConsoleTab>
): Tabs {
    const apply = (t: ConsoleTab) => (t.id === id ? { ...t, ...change } : t);
    const [first, ...rest] = state.tabs;
    return { ...state, tabs: [apply(first), ...rest.map(apply)] };
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
export function readTabs(): Tabs {
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

export function writeTabs(state: Tabs): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // storage blocked or full: tabs last until the page is reloaded
    }
}
