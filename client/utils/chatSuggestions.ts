import type { PendingChips } from './chatChips';

export interface Suggestion {
    text: string;
    /** The Key the prompt is about, attached as it is sent. */
    attachKey?: string;
    /** Attach the Console's line under the cursor as it is sent. */
    attachCursorLine?: true;
}

const NO_TTL = 'Which keys have no TTL?';
const BIGGEST = 'What are the biggest keys?';
const QUEUES = 'Which queues are backing up?';

const plain = (...texts: string[]): Suggestion[] =>
    texts.map((text) => ({ text }));

/**
 * Only ask for what the assistant's tools can answer: there is none for the
 * slow log.
 */
export function suggestionsFor(
    pathname: string,
    chips: PendingChips,
    selectedKey: string | null
): Suggestion[] {
    if (chips.line) {
        return plain(
            'Explain this query',
            'Is this safe to run on production?',
            'Make it faster'
        );
    }
    if (chips.result) {
        return plain('Explain this result');
    }
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
        return [
            { text: 'Explain the line at my cursor', attachCursorLine: true },
            ...plain(NO_TTL, BIGGEST)
        ];
    }
    const explain: Suggestion =
        pathname === '/keys' && selectedKey !== null
            ? { text: 'Explain the selected key', attachKey: selectedKey }
            : { text: 'Explain a key' };
    return [explain, ...plain(NO_TTL, BIGGEST, QUEUES)];
}
