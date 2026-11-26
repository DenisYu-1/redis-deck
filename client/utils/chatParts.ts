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

const MAX_ARGS_CHARS = 200;

const cut = (text: string) =>
    text.length > MAX_ARGS_CHARS ? `${text.slice(0, MAX_ARGS_CHARS)}…` : text;

// What a later turn has to know of a part: what was said, and what each tool
// call and write came to, without the responses.
function lineOf(part: ChatPart): string[] {
    switch (part.type) {
        case 'text':
        case 'notice':
            return [part.text];
        case 'tool': {
            const args = cut(JSON.stringify(part.args));
            return [`[Tool call ${part.tool} ${args}: ${part.status}]`];
        }
        case 'approval': {
            const commands = cut(part.commands.join('; '));
            const failed = part.error ? ', failed' : '';
            return [
                `[Write ${part.tool} on ${part.connectionId} (${commands}): ${part.state}${failed}]`
            ];
        }
        case 'error':
            return [];
    }
}

const textOf = (parts: ChatPart[]): string =>
    parts.flatMap(lineOf).join('\n\n');

/** The chat as sent with the next turn. */
export const transcriptOf = (
    messages: ChatMessage[]
): ChatTurnRequest['messages'] =>
    messages.map((m) =>
        m.role === 'user' ? m : { role: m.role, text: textOf(m.parts) }
    );
