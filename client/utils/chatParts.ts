import type { ChatEvent, ChatPart, ChatTurnRequest } from '@/services/aiChat';
import type { ChatChip, LineChip } from './chatChips';

export type ChatMessage =
    | { role: 'user'; text: string; chips?: ChatChip[] }
    | { role: 'assistant'; parts: ChatPart[] };

/** The Console line a question was asked about, if it had that chip. */
export const lineAskedAbout = (
    question: ChatMessage | undefined
): LineChip | undefined =>
    question?.role === 'user'
        ? question.chips?.find((c): c is LineChip => c.kind === 'line')
        : undefined;

/** An assistant message's parts after one more event of its turn. */
export function applyEvent(parts: ChatPart[], event: ChatEvent): ChatPart[] {
    if (event.type === 'done') return parts;
    const last = parts.at(-1);
    if (event.type === 'text' && last?.type === 'text') {
        const text = last.text + event.text;
        return [...parts.slice(0, -1), { type: 'text', text }];
    }
    if (event.type === 'tool') {
        const isSame = (p: ChatPart) => p.type === 'tool' && p.id === event.id;
        if (parts.some(isSame)) {
            return parts.map((p) => (isSame(p) ? event : p));
        }
    }
    return [...parts, event];
}

/** A turn that ended leaves no tool row spinning. */
export const endTurn = (parts: ChatPart[]): ChatPart[] =>
    parts.map((p) =>
        p.type === 'tool' && p.status === 'running'
            ? { ...p, status: 'error' }
            : p
    );

const textOf = (parts: ChatPart[]): string =>
    parts
        .flatMap((p) =>
            p.type === 'text' || p.type === 'notice' ? [p.text] : []
        )
        .join('\n\n');

/** The chat as sent with the next turn: what was said, not the tool rows. */
export const transcriptOf = (
    messages: ChatMessage[]
): ChatTurnRequest['messages'] =>
    messages.map((m) =>
        m.role === 'user' ? m : { role: m.role, text: textOf(m.parts) }
    );
