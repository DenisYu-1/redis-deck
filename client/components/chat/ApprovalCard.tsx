import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertIcon } from '@/components/ui/Icons';
import type { ChatApproval } from '@/services/aiChat';
import { useAppStore } from '@/store/useAppStore';

/** What became of a write: approved, ran without asking, denied or blocked. */
function Outcome({ card }: { card: ChatApproval }) {
    const { state, reason, done, error } = card;
    if (state === 'denied') return <span className="pill off">Denied</span>;
    if (state === 'blocked') {
        return (
            <>
                <span className="pill blocked">Blocked</span>
                <span className="sm tx2">{reason}</span>
            </>
        );
    }
    const label = state === 'auto' ? 'Ran without asking' : 'Approved';
    return (
        <>
            <span className={`pill ${error ? 'error' : 'ok'}`}>
                {label} · {error ? 'failed' : done}
            </span>
            {error && <span className="sm tx2">{error}</span>}
            {reason && <span className="xs mu">{reason}</span>}
        </>
    );
}

function Answer({ id }: { id: string }) {
    const answer = useAppStore((s) => s.answerChatApproval);
    // One answer per card; the server then sends the card's new state.
    const [sent, setSent] = useState(false);
    const send = (approved: boolean) => {
        setSent(true);
        void answer(id, approved).then((taken) => setSent(taken));
    };
    return (
        <>
            <Button
                size="sm"
                variant="primary"
                disabled={sent}
                onClick={() => send(true)}
            >
                Approve
            </Button>
            <Button size="sm" disabled={sent} onClick={() => send(false)}>
                Deny
            </Button>
        </>
    );
}

/** A write the assistant proposes, or what became of it. */
export function ApprovalCard({ card }: { card: ChatApproval }) {
    const pending = card.state === 'pending';
    return (
        <div
            className={`chat-appr ${pending ? '' : 'done'}`}
            role="group"
            aria-label={card.title}
        >
            <span className="chat-appr-title">
                {pending && <AlertIcon />}
                {card.title}
            </span>
            <pre className="codeline">{card.commands.join('\n')}</pre>
            <span className="xs mu">
                via MCP tool <span className="mono">{card.tool}</span> on{' '}
                {card.connectionId}
            </span>
            <div className="chat-appr-foot">
                {pending ? <Answer id={card.id} /> : <Outcome card={card} />}
            </div>
        </div>
    );
}
