/**
 * Context attached to a question. A chip names things and never carries a Key's
 * value: the assistant reads it with its tools. The server turns each kind into
 * text (services/ai/chips.js), so a new kind is added here and there.
 */
export interface KeyChip {
    kind: 'key';
    connectionId: string;
    key: string;
}

export type ChatChip = KeyChip;

/** The chips waiting to be sent: at most one of each kind. */
export type PendingChips = { [C in ChatChip as C['kind']]?: C };

export const chipLabel = (chip: ChatChip): string => chip.key;
