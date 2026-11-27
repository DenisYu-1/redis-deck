import type { ConsoleResult } from '@/services/apiService';

/**
 * Context attached to a question. The server turns each kind into text
 * (services/ai/chips.js), so a new kind is added here and there. A Key chip
 * names the Key and never carries its value: the assistant reads that with its
 * tools. A Console result is masked by the server before a model sees it.
 */
export interface KeyChip {
    kind: 'key';
    connectionId: string;
    key: string;
}

/** A statement of the Console: its text, and where it is in the editor. */
export interface LineChip {
    kind: 'line';
    connectionId: string;
    /** 1-based */
    line: number;
    text: string;
    tabId: number;
    tabName: string;
}

export interface ResultChip {
    kind: 'result';
    connectionId: string;
    line: number;
    text: string;
    resultKind: ConsoleResult['kind'];
    /** Left out when too large to send */
    reply?: unknown;
}

export type ChatChip = KeyChip | LineChip | ResultChip;

/** The chips waiting to be sent: at most one of each kind. */
export type PendingChips = { [C in ChatChip as C['kind']]?: C };

export function chipLabel(chip: ChatChip): string {
    if (chip.kind === 'key') return chip.key;
    const line = `L${chip.line} ${chip.text}`;
    return chip.kind === 'result' ? `Result of ${line}` : line;
}
