import { useCallback, useRef, useState } from 'react';
import { listAiLocalModels } from '@/services/apiService';

export interface LocalModels {
    models: string[];
    error: string | null;
    /** Asks the server at this URL for its models */
    load: (url: string) => void;
    /** Takes a list that is already known (from Test) */
    offer: (models: string[]) => void;
}

/** The models of the Local model server. `pick` gets every list received. */
export function useLocalModels(pick: (models: string[]) => void): LocalModels {
    const [models, setModels] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    // Answers for an URL that has since been replaced are dropped.
    const latest = useRef('');

    const offer = useCallback(
        (next: string[]) => {
            setModels(next);
            setError(null);
            pick(next);
        },
        [pick]
    );

    const load = useCallback(
        (url: string) => {
            const asked = url.trim();
            latest.current = asked;
            setError(null);
            if (!asked) {
                setModels([]);
                return;
            }
            listAiLocalModels(asked).then(
                (next) => {
                    if (latest.current === asked) offer(next);
                },
                (e: Error) => {
                    if (latest.current !== asked) return;
                    setModels([]);
                    setError(e.message);
                }
            );
        },
        [offer]
    );

    return { models, error, load, offer };
}
