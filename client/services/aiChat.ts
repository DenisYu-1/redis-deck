// One turn of the AI assistant. The server streams one JSON event per line.
import type { ChatChip } from '@/utils/chatChips';

export type ChatToolStatus = 'running' | 'ok' | 'denied' | 'blocked' | 'error';

export interface ChatToolCall {
    type: 'tool';
    id: string;
    tool: string;
    args: Record<string, unknown>;
    status: ChatToolStatus;
    ms?: number;
    /** What the model got back: JSON text, or the refusal */
    response?: string;
}

export type ChatPart =
    | { type: 'text'; text: string }
    | ChatToolCall
    | { type: 'notice'; text: string }
    | { type: 'error'; message: string };

export type ChatEvent = ChatPart | { type: 'done' };

export interface ChatTurnRequest {
    chatId: string;
    connectionId: string;
    /** The whole transcript, ending with the new question */
    messages: {
        role: 'user' | 'assistant';
        text: string;
        chips?: ChatChip[];
    }[];
}

/** Resolves once the turn is done; rejects when it cannot run or is cut off. */
export async function streamAiChat(
    request: ChatTurnRequest,
    {
        signal,
        onEvent
    }: { signal: AbortSignal; onEvent: (event: ChatEvent) => void }
): Promise<void> {
    const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal
    });
    if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(body?.error ?? response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            const event = JSON.parse(line) as ChatEvent;
            onEvent(event);
            if (event.type === 'done') return;
        }
    }
    throw new Error('The connection to the server was lost');
}
