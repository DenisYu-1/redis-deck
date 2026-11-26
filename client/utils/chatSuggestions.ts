import type { PendingChips } from './chatChips';

export interface Suggestion {
    text: string;
    /** The Key the prompt is about, attached as it is sent. */
    attachKey?: string;
}

const NO_TTL = 'Which keys have no TTL?';
const BIGGEST = 'What are the biggest keys?';
const QUEUES = 'Which queues are backing up?';

const plain = (...texts: string[]): Suggestion[] =>
    texts.map((text) => ({ text }));

/**
 * Only ask for what the assistant's tools can answer: there is none for the
 * slow log, and it cannot see the Console's cursor.
 */
export function suggestionsFor(
    pathname: string,
    chips: PendingChips,
    selectedKey: string | null
): Suggestion[] {
    if (chips.key) {
        return plain('Explain this key', 'Why does it have this TTL?', NO_TTL);
    }
    if (pathname.startsWith('/stats')) {
        return plain(
            'Why is RSS higher than used memory?',
            'Is anything wrong with this server?',
            QUEUES
        );
    }
    if (pathname === '/console') {
        return plain(
            NO_TTL,
            BIGGEST,
            'How do I scan keys without blocking Redis?'
        );
    }
    const explain: Suggestion =
        pathname === '/keys' && selectedKey !== null
            ? { text: 'Explain the selected key', attachKey: selectedKey }
            : { text: 'Explain a key' };
    return [explain, ...plain(NO_TTL, BIGGEST, QUEUES)];
}
