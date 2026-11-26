import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TierBadge } from '@/components/ui/Badge';
import { CloseIcon, KeyIcon, ConsoleIcon } from '@/components/ui/Icons';
import { listAiAccess } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { chipLabel } from '@/utils/chatChips';

/** What goes with the next question: the current Connection and any chips. */
export function ContextBar() {
    const current = useAppStore((s) => s.currentEnvironment);
    const connection = useAppStore((s) =>
        s.connections.find((c) => c.id === s.currentEnvironment)
    );
    const chips = useAppStore((s) => s.chat.chips);
    const addChip = useAppStore((s) => s.addChatChip);
    const removeChip = useAppStore((s) => s.removeChatChip);
    const addCursorLine = useAppStore((s) => s.addCursorLineChip);
    const selectedKey = useAppStore((s) => s.selectedKey);
    const { pathname } = useLocation();
    const valuesHidden = useAppStore(
        (s) => s.aiAccess.find((r) => r.id === current)?.values === false
    );
    const setAiAccessRows = useAppStore((s) => s.setAiAccessRows);

    // Again when the Connection changes: its Tier decides the defaults.
    useEffect(() => {
        listAiAccess().then(setAiAccessRows, (error: unknown) =>
            console.error('Failed to load AI access:', error)
        );
    }, [connection, setAiAccessRows]);
    // The selection outlives the Keys page; only offer it while it is on screen.
    const keyToAdd =
        pathname === '/keys' && chips.key?.key !== selectedKey
            ? selectedKey
            : null;

    return (
        <div className="chat-context" aria-label="Context">
            <span className="chat-chip" title="Current Connection">
                <TierBadge tier={connection?.tier ?? 'local'} />
                <span className="mono ellip">{current}</span>
                {valuesHidden && <span className="xs mu">values hidden</span>}
            </span>
            {Object.values(chips).map((chip) => (
                <span
                    key={chip.kind}
                    className="chat-chip"
                    title={chipLabel(chip)}
                >
                    {chip.kind === 'key' ? <KeyIcon /> : <ConsoleIcon />}
                    <span className="mono ellip">{chipLabel(chip)}</span>
                    <button
                        type="button"
                        aria-label={`Remove ${chipLabel(chip)} from context`}
                        onClick={() => removeChip(chip.kind)}
                    >
                        <CloseIcon />
                    </button>
                </span>
            ))}
            {keyToAdd !== null && current && (
                <button
                    type="button"
                    className="chat-add"
                    onClick={() =>
                        addChip({
                            kind: 'key',
                            connectionId: current,
                            key: keyToAdd
                        })
                    }
                >
                    + Selected key
                </button>
            )}
            {pathname === '/console' && current && (
                <button
                    type="button"
                    className="chat-add"
                    onClick={addCursorLine}
                >
                    + Current line
                </button>
            )}
        </div>
    );
}
