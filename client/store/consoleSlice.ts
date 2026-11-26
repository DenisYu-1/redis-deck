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
import type { LineChip } from '@/utils/chatChips';

export interface ConsoleSlice {
    /** null until first changed: the browser's storage has them */
    consoleTabs: Tabs | null;
    /** The cursor's offset in the open tab's text */
    consoleCursor: number;
    setConsoleCursor: (cursor: number) => void;
    updateConsoleTabs: (change: (tabs: Tabs) => Tabs) => void;
    /** Adds `code` to the open tab after a blank line; returns the tab's name. */
    appendToConsole: (code: string) => string;
    /**
     * Replaces the line asked about and opens its tab. False when the tab is
     * gone or the line no longer holds that statement.
     */
    replaceConsoleLine: (asked: LineChip, text: string) => boolean;
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
        replaceConsoleLine: ({ tabId, line, text: asked }, text) => {
            const state = tabs();
            const lines = state.tabs
                .find((t) => t.id === tabId)
                ?.script.split('\n');
            if (lines?.[line - 1]?.trim() !== asked) return false;
            lines[line - 1] = text;
            const script = lines.join('\n');
            save({ ...patchTab(state, tabId, { script }), activeId: tabId });
            return true;
        }
    };
};
