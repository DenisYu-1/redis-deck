import { useEffect, useRef } from 'react';
import { SendIcon } from '@/components/ui/Icons';
import { useAppStore } from '@/store/useAppStore';
import { WritesNote } from './WritesNote';

const MAX_HEIGHT = 140;

/** The message box. Enter sends, Shift+Enter starts a new line. */
export function ChatComposer() {
    const connection = useAppStore((s) => s.currentEnvironment);
    const draft = useAppStore((s) => s.chat.draft);
    const busy = useAppStore((s) => s.chat.busy);
    const noModel = useAppStore((s) => s.aiModel?.ready === false);
    const setDraft = useAppStore((s) => s.setChatDraft);
    const send = useAppStore((s) => s.sendChatMessage);
    const input = useRef<HTMLTextAreaElement>(null);

    useEffect(() => input.current?.focus(), []);

    useEffect(() => {
        const el = input.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }, [draft]);

    return (
        <form
            className="chat-composer"
            onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
            }}
        >
            <div className="chat-box">
                <textarea
                    ref={input}
                    rows={1}
                    aria-label="Message the assistant"
                    placeholder={`Ask about ${connection ?? 'Redis'}…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                        ) {
                            e.preventDefault();
                            void send(draft);
                        }
                    }}
                />
                <button
                    type="submit"
                    className="chat-send"
                    aria-label="Send"
                    disabled={busy}
                >
                    <SendIcon />
                </button>
            </div>
            {noModel ? (
                <span className="xs mu">No model is set up yet</span>
            ) : (
                <WritesNote />
            )}
        </form>
    );
}
