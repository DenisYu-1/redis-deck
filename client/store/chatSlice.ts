// The AI assistant's chat: in memory for the browser session, gone on reload.
import type { StateCreator } from 'zustand';
import { streamAiChat, type ChatPart } from '@/services/aiChat';
import type { AiAccessRow, AiModelSettings } from '@/services/apiService';
import type { ChatChip, PendingChips, ResultChip } from '@/utils/chatChips';
import {
    applyEvent,
    endTurn,
    transcriptOf,
    type ChatMessage
} from '@/utils/chatParts';
import { cursorLineChip } from '@/utils/consoleChips';
import { showToast } from '@/utils/toast';
import type { ConsoleSlice } from './consoleSlice';

export interface ChatState {
    id: string;
    open: boolean;
    messages: ChatMessage[];
    /** A turn is running; only one at a time. */
    busy: boolean;
    draft: string;
    /** Go with each question until removed. */
    chips: PendingChips;
}

export interface ChatSlice {
    chat: ChatState;
    /** The assistant's model settings, once loaded. */
    aiModel: AiModelSettings | null;
    setAiModel: (aiModel: AiModelSettings) => void;
    /** AI access per Connection, shared by the AI page and the chat. */
    aiAccess: AiAccessRow[];
    setAiAccessRows: (rows: AiAccessRow[]) => void;
    setChatOpen: (open: boolean) => void;
    setChatDraft: (draft: string) => void;
    newChat: () => void;
    /** A Console line and a result take each other's place. */
    addChatChip: (chip: ChatChip) => void;
    /** Attaches the Console's line under the cursor; false when it has none. */
    addCursorLineChip: () => boolean;
    removeChatChip: (kind: ChatChip['kind']) => void;
    /** A page's "Ask" button: opens the chat, attaches the chip and asks. */
    askAbout: (chip: ResultChip, prompt: string) => void;
    /** The same for the Console's line under the cursor, if it has one. */
    askAboutCursorLine: (prompt: string) => void;
    sendChatMessage: (text: string) => Promise<void>;
}

// Not crypto.randomUUID: plain-HTTP hosts have no secure context.
const newChatId = () => Math.random().toString(36).slice(2);

let turn: AbortController | null = null;

type WithPage = ChatSlice &
    Pick<ConsoleSlice, 'consoleTabs' | 'consoleCursor'> & {
        currentEnvironment: string | null;
    };

export const createChatSlice: StateCreator<WithPage, [], [], ChatSlice> = (
    set,
    get
) => {
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
            draft: '',
            chips: {}
        },
        aiModel: null,
        setAiModel: (aiModel) => set({ aiModel }),
        aiAccess: [],
        setAiAccessRows: (aiAccess) => set({ aiAccess }),
        setChatOpen: (open) => patch({ open }),
        setChatDraft: (draft) => patch({ draft }),
        newChat: () => {
            turn?.abort();
            patch({
                id: newChatId(),
                messages: [],
                busy: false,
                draft: '',
                chips: {}
            });
        },
        addChatChip: (chip) => {
            const { chips } = get().chat;
            const { key } = chips;
            patch({
                chips:
                    chip.kind === 'key'
                        ? { ...chips, key: chip }
                        : // only one thing of the Console at a time
                          { ...(key && { key }), [chip.kind]: chip }
            });
        },
        addCursorLineChip: () => {
            const { currentEnvironment, consoleTabs, consoleCursor } = get();
            const chip =
                currentEnvironment &&
                cursorLineChip(currentEnvironment, consoleTabs, consoleCursor);
            if (!chip) {
                showToast('No command on this line', 'info');
                return false;
            }
            get().addChatChip(chip);
            return true;
        },
        removeChatChip: (kind) => {
            const { [kind]: removed, ...chips } = get().chat.chips;
            if (removed) patch({ chips });
        },
        askAbout: (chip, prompt) => {
            patch({ open: true });
            get().addChatChip(chip);
            void get().sendChatMessage(prompt);
        },
        askAboutCursorLine: (prompt) => {
            if (!get().addCursorLineChip()) return;
            patch({ open: true });
            void get().sendChatMessage(prompt);
        },
        sendChatMessage: async (input) => {
            const text = input.trim();
            const connectionId = get().currentEnvironment;
            const { id, busy, messages } = get().chat;
            const chips = Object.values(get().chat.chips);
            if (!text || busy || !connectionId) return;
            const question: ChatMessage = {
                role: 'user',
                text,
                ...(chips.length > 0 && { chips })
            };
            const asked = [...messages, question];
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
