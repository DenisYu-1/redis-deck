// The Console's tabs and cursor: in the store, because the chat reads the
// current line and puts code into the editor. Nothing here runs a command.
import type { StateCreator } from 'zustand';
import {
    activeTab,
    patchTab,
    readTabs,
    writeTabs,
    type Tabs
} from '@/pages/Console/tabs';

export interface ConsoleSlice {
    /** null until first changed: the browser's storage has them */
    consoleTabs: Tabs | null;
    /** The cursor's offset in the open tab's text */
    consoleCursor: number;
    setConsoleCursor: (cursor: number) => void;
    updateConsoleTabs: (change: (tabs: Tabs) => Tabs) => void;
    /** Adds `code` to the open tab after a blank line; returns the tab's name. */
    appendToConsole: (code: string) => string;
    /** Opens the tab. False when the tab or the line is gone. */
    replaceConsoleLine: (tabId: number, line: number, text: string) => boolean;
}

export const createConsoleSlice: StateCreator<
    ConsoleSlice,
    [],
    [],
    ConsoleSlice
> = (set, get) => {
    const tabs = () => get().consoleTabs ?? readTabs();
    const save = (next: Tabs) => {
        writeTabs(next);
        set({ consoleTabs: next });
    };

    return {
        consoleTabs: null,
        consoleCursor: 0,
        setConsoleCursor: (consoleCursor) => set({ consoleCursor }),
        updateConsoleTabs: (change) => save(change(tabs())),
        appendToConsole: (code) => {
            const state = tabs();
            const { id, name, script } = activeTab(state);
            const before = script.trimEnd();
            const next = before ? `${before}\n\n${code}` : code;
            save(patchTab(state, id, { script: next }));
            return name;
        },
        replaceConsoleLine: (tabId, line, text) => {
            const state = tabs();
            const lines = state.tabs
                .find((t) => t.id === tabId)
                ?.script.split('\n');
            if (!lines || line > lines.length) return false;
            lines[line - 1] = text;
            const script = lines.join('\n');
            save({ ...patchTab(state, tabId, { script }), activeId: tabId });
            return true;
        }
    };
};
