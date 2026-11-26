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

/** `auto`: ran without asking, as AI access allows. */
export type ChatApprovalState =
    'pending' | 'approved' | 'auto' | 'denied' | 'blocked';

/** A write of the assistant: its approval card. */
export interface ChatApproval {
    type: 'approval';
    id: string;
    tool: string;
    connectionId: string;
    title: string;
    /** The commands the write runs, one per line */
    commands: string[];
    state: ChatApprovalState;
    reason?: string;
    /** What the write did */
    done?: string;
    /** Why it failed after all */
    error?: string;
}

export type ChatPart =
    | { type: 'text'; text: string }
    | ChatToolCall
    | ChatApproval
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

/** Approve or Deny a waiting write; rejects when it no longer waits. */
export async function answerAiApproval(reply: {
    chatId: string;
    id: string;
    approved: boolean;
}): Promise<void> {
    const response = await fetch('/api/ai-chat/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reply),
        // Also sent while the page goes away.
        keepalive: true
    });
    if (!response.ok) throw new Error(await errorOf(response));
}

async function errorOf(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: string;
    } | null;
    return body?.error ?? response.statusText;
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
        throw new Error(await errorOf(response));
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
