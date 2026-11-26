// The AI assistant's chat: in memory for the browser session, gone on reload.
import type { StateCreator } from 'zustand';
import { streamAiChat, type ChatPart } from '@/services/aiChat';
import type { AiModelSettings } from '@/services/apiService';
import {
    applyEvent,
    endTurn,
    transcriptOf,
    type ChatMessage
} from '@/utils/chatParts';

export interface ChatState {
    id: string;
    open: boolean;
    messages: ChatMessage[];
    /** A turn is running; only one at a time. */
    busy: boolean;
    draft: string;
}

export interface ChatSlice {
    chat: ChatState;
    /** The assistant's model settings, once loaded. */
    aiModel: AiModelSettings | null;
    setAiModel: (aiModel: AiModelSettings) => void;
    setChatOpen: (open: boolean) => void;
    setChatDraft: (draft: string) => void;
    newChat: () => void;
    sendChatMessage: (text: string) => Promise<void>;
}

// Not crypto.randomUUID: plain-HTTP hosts have no secure context.
const newChatId = () => Math.random().toString(36).slice(2);

let turn: AbortController | null = null;

type WithConnection = ChatSlice & { currentEnvironment: string | null };

export const createChatSlice: StateCreator<
    WithConnection,
    [],
    [],
    ChatSlice
> = (set, get) => {
    const patch = (change: Partial<ChatState>) =>
        set((s) => ({ chat: { ...s.chat, ...change } }));

    /** Rewrites the answer being streamed, unless its chat is gone. */
    const answer = (
        chatId: string,
        change: (parts: ChatPart[]) => ChatPart[]
    ) => {
        const { id, messages } = get().chat;
        const last = messages.at(-1);
        if (id !== chatId || last?.role !== 'assistant') return;
        patch({
            messages: [
                ...messages.slice(0, -1),
                { role: 'assistant', parts: change(last.parts) }
            ]
        });
    };

    return {
        chat: {
            id: newChatId(),
            open: false,
            messages: [],
            busy: false,
            draft: ''
        },
        aiModel: null,
        setAiModel: (aiModel) => set({ aiModel }),
        setChatOpen: (open) => patch({ open }),
        setChatDraft: (draft) => patch({ draft }),
        newChat: () => {
            turn?.abort();
            patch({ id: newChatId(), messages: [], busy: false, draft: '' });
        },
        sendChatMessage: async (input) => {
            const text = input.trim();
            const connectionId = get().currentEnvironment;
            const { id, busy, messages } = get().chat;
            if (!text || busy || !connectionId) return;
            const asked: ChatMessage[] = [...messages, { role: 'user', text }];
            patch({
                messages: [...asked, { role: 'assistant', parts: [] }],
                busy: true,
                draft: ''
            });
            const controller = new AbortController();
            turn = controller;
            try {
                await streamAiChat(
                    {
                        chatId: id,
                        connectionId,
                        messages: transcriptOf(asked)
                    },
                    {
                        signal: controller.signal,
                        onEvent: (event) =>
                            answer(id, (parts) => applyEvent(parts, event))
                    }
                );
            } catch (error) {
                const message = (error as Error).message;
                answer(id, (parts) =>
                    applyEvent(parts, { type: 'error', message })
                );
            } finally {
                answer(id, endTurn);
                if (get().chat.id === id) patch({ busy: false });
            }
        }
    };
};
