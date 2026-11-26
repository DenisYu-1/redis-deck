import { useEffect, useRef } from 'react';
import type { ChatPart } from '@/services/aiChat';
import { useAppStore } from '@/store/useAppStore';
import { chipLabel, type LineChip } from '@/utils/chatChips';
import { lineAskedAbout } from '@/utils/chatParts';
import { ApprovalCard } from './ApprovalCard';
import { Markdown } from './Markdown';
import { Suggestions } from './Suggestions';
import { ToolRow } from './ToolRow';

function Part({ part, line }: { part: ChatPart; line: LineChip | undefined }) {
    if (part.type === 'text') {
        return <Markdown text={part.text} line={line} />;
    }
    if (part.type === 'tool') return <ToolRow call={part} />;
    if (part.type === 'approval') return <ApprovalCard card={part} />;
    if (part.type === 'notice') {
        return <p className="sm mu">{part.text}</p>;
    }
    return (
        <div className="callout err" role="alert">
            {part.message}
        </div>
    );
}

/** Nothing is streaming right now, but the turn is not over. */
const isThinking = (parts: ChatPart[]) => {
    const last = parts.at(-1);
    return (
        !last ||
        (last.type === 'tool' && last.status !== 'running') ||
        (last.type === 'approval' && last.state !== 'pending')
    );
};

function EmptyChat() {
    const connection = useAppStore((s) => s.currentEnvironment);
    return (
        <div className="chat-empty">
            <b>Ask about {connection}</b>
            <p className="sm tx2">
                The assistant reads keys and INFO through Redis Deck’s MCP tools
                and drafts commands for you. Changes follow your AI access
                rules.
            </p>
            <Suggestions />
        </div>
    );
}

export function ChatMessages() {
    const messages = useAppStore((s) => s.chat.messages);
    const busy = useAppStore((s) => s.chat.busy);
    const log = useRef<HTMLDivElement>(null);
    // Follow the answer unless the user has scrolled up to read.
    const follow = useRef(true);

    useEffect(() => {
        const el = log.current;
        if (el && follow.current) el.scrollTop = el.scrollHeight;
    }, [messages]);

    return (
        <div
            className="chat-msgs"
            role="log"
            aria-live="polite"
            ref={log}
            onScroll={(e) => {
                const el = e.currentTarget;
                follow.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
        >
            {messages.length === 0 && <EmptyChat />}
            {messages.map((message, i) =>
                message.role === 'user' ? (
                    <div key={i} className="chat-msg user">
                        {message.chips && (
                            <span className="chat-sent mono ellip">
                                {message.chips.map(chipLabel).join(' · ')}
                            </span>
                        )}
                        {message.text}
                    </div>
                ) : (
                    <div key={i} className="chat-msg ai">
                        {message.parts.map((part, p) => (
                            <Part
                                key={p}
                                part={part}
                                line={lineAskedAbout(messages[i - 1])}
                            />
                        ))}
                        {busy &&
                            i === messages.length - 1 &&
                            isThinking(message.parts) && (
                                <span
                                    className="chat-typing"
                                    role="img"
                                    aria-label="Thinking"
                                >
                                    <i />
                                    <i />
                                    <i />
                                </span>
                            )}
                    </div>
                )
            )}
        </div>
    );
}
