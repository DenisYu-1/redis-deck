import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { suggestionsFor } from '@/utils/chatSuggestions';

/** The empty chat's prompts for the page on screen. A click sends one. */
export function Suggestions() {
    const { pathname } = useLocation();
    const connectionId = useAppStore((s) => s.currentEnvironment);
    const chips = useAppStore((s) => s.chat.chips);
    const selectedKey = useAppStore((s) => s.selectedKey);
    const addChip = useAppStore((s) => s.addChatChip);
    const send = useAppStore((s) => s.sendChatMessage);

    return (
        <div
            className="chat-suggestions"
            role="group"
            aria-label="Suggested prompts"
        >
            {suggestionsFor(pathname, chips, selectedKey).map((s) => (
                <button
                    key={s.text}
                    type="button"
                    onClick={() => {
                        if (s.attachKey && connectionId) {
                            addChip({
                                kind: 'key',
                                connectionId,
                                key: s.attachKey
                            });
                        }
                        void send(s.text);
                    }}
                >
                    {s.text}
                </button>
            ))}
        </div>
    );
}
