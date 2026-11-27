import { useEffect, useRef } from 'react';
import { ChatIcon } from '@/components/ui/Icons';
import { useAppStore } from '@/store/useAppStore';
import { ChatPanel } from './ChatPanel';

const isMac = navigator.userAgent.includes('Mac');
const SHORTCUT = isMac ? '⌘J' : 'Ctrl+J';

/** The floating button and, once opened, the chat side panel. */
export function AssistantDock() {
    const open = useAppStore((s) => s.chat.open);
    const setOpen = useAppStore((s) => s.setChatOpen);
    const button = useRef<HTMLButtonElement>(null);
    const wasOpen = useRef(open);

    // Closing hands the focus back to the button.
    useEffect(() => {
        if (wasOpen.current && !open) button.current?.focus();
        wasOpen.current = open;
    }, [open]);

    useEffect(() => {
        const toggle = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                setOpen(!useAppStore.getState().chat.open);
            }
        };
        window.addEventListener('keydown', toggle);
        return () => window.removeEventListener('keydown', toggle);
    }, [setOpen]);

    if (open) return <ChatPanel />;
    return (
        <button
            ref={button}
            type="button"
            className="chat-fab"
            aria-label={`Open assistant (${SHORTCUT})`}
            onClick={() => setOpen(true)}
        >
            <ChatIcon />
            <span>Ask</span>
            <kbd>{SHORTCUT}</kbd>
        </button>
    );
}
