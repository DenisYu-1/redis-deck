// The chips made from the Console.
import { selectedStatements } from '@/pages/Console/statements';
import { activeTab, readTabs, type Tabs } from '@/pages/Console/tabs';
import type { ConsoleResult } from '@/services/apiService';
import type { LineChip, ResultChip } from './chatChips';

const MAX_ITEMS = 200;
const MAX_REPLY_CHARS = 50_000;

/** The statement on the line under the cursor of the open tab, if any. */
export function cursorLineChip(
    connectionId: string,
    tabs: Tabs | null,
    cursor: number
): LineChip | null {
    const { id, name, script } = activeTab(tabs ?? readTabs());
    const [statement] = selectedStatements(script, cursor, cursor);
    if (!statement) return null;
    return {
        kind: 'line',
        connectionId,
        ...statement,
        tabId: id,
        tabName: name
    };
}

// Long lists keep their first entries: an even number, so that field, value
// pairs stay whole.
const shorten = (reply: unknown): unknown =>
    Array.isArray(reply) ? reply.slice(0, MAX_ITEMS).map(shorten) : reply;

export function resultChip(
    connectionId: string,
    { line, text, kind, reply }: ConsoleResult
): ResultChip {
    const short = shorten(reply);
    // The whole chat is sent with every question, so each reply stays small.
    const fits = JSON.stringify(short ?? null).length <= MAX_REPLY_CHARS;
    return {
        kind: 'result',
        connectionId,
        line,
        text,
        resultKind: kind,
        ...(fits && { reply: short })
    };
}
