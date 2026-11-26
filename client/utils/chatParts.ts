import type { ChatEvent, ChatPart, ChatTurnRequest } from '@/services/aiChat';

export type ChatMessage =
    { role: 'user'; text: string } | { role: 'assistant'; parts: ChatPart[] };

/** An assistant message's parts after one more event of its turn. */
export function applyEvent(parts: ChatPart[], event: ChatEvent): ChatPart[] {
    if (event.type === 'done') return parts;
    const last = parts.at(-1);
    if (event.type === 'text' && last?.type === 'text') {
        const text = last.text + event.text;
        return [...parts.slice(0, -1), { type: 'text', text }];
    }
    // A tool row and an approval card are updated in place.
    if (event.type === 'tool' || event.type === 'approval') {
        const isSame = (p: ChatPart) =>
            p.type === event.type && 'id' in p && p.id === event.id;
        if (parts.some(isSame)) {
            return parts.map((p) => (isSame(p) ? event : p));
        }
    }
    return [...parts, event];
}

/** A turn that ended leaves no tool row spinning and no card waiting. */
export const endTurn = (parts: ChatPart[]): ChatPart[] =>
    parts.map((p) => {
        if (p.type === 'tool' && p.status === 'running') {
            return { ...p, status: 'error' };
        }
        if (p.type === 'approval' && p.state === 'pending') {
            return { ...p, state: 'denied' };
        }
        return p;
    });

/** The cards of the chat that still wait for an answer. */
export const pendingApprovals = (messages: ChatMessage[]): string[] =>
    messages.flatMap((m) =>
        m.role === 'user'
            ? []
            : m.parts.flatMap((p) =>
                  p.type === 'approval' && p.state === 'pending' ? [p.id] : []
              )
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
    messages.map((m) => ({
        role: m.role,
        text: m.role === 'user' ? m.text : textOf(m.parts)
    }));
