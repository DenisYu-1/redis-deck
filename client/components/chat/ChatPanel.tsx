import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChatIcon, CloseIcon, PlusIcon } from '@/components/ui/Icons';
import { getAiModel } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { modelLabel } from '@/utils/aiModelLabel';
import { ChatComposer } from './ChatComposer';
import { ChatMessages } from './ChatMessages';
import { ContextBar } from './ContextBar';

export function ChatPanel() {
    const aiModel = useAppStore((s) => s.aiModel);
    const setAiModel = useAppStore((s) => s.setAiModel);
    const setOpen = useAppStore((s) => s.setChatOpen);
    const newChat = useAppStore((s) => s.newChat);

    useEffect(() => {
        getAiModel().then(setAiModel, (error: unknown) =>
            console.error('Failed to load the assistant’s model:', error)
        );
    }, [setAiModel]);

    return (
        <aside
            className="chat"
            aria-label="Assistant"
            onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
            }}
        >
            <div className="chat-head">
                <ChatIcon />
                <b>Assistant</b>
                {aiModel && (
                    <Link
                        className="pill off chat-model"
                        to="/ai"
                        title="Change the model in AI assistant settings"
                    >
                        <span className="ellip">{modelLabel(aiModel)}</span>
                    </Link>
                )}
                <span className="chat-spacer" />
                <button
                    type="button"
                    className="iconbtn ghost"
                    aria-label="New chat"
                    title="New chat"
                    onClick={newChat}
                >
                    <PlusIcon />
                </button>
                <button
                    type="button"
                    className="iconbtn ghost"
                    aria-label="Close assistant"
                    title="Close (Esc)"
                    onClick={() => setOpen(false)}
                >
                    <CloseIcon />
                </button>
            </div>
            <ContextBar />
            <ChatMessages />
            <ChatComposer />
        </aside>
    );
}
