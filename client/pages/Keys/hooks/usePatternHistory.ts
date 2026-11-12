import { useCallback, useState } from 'react';

const MAX = 10;
const key = (env: string) => `redis:patternHistory:${env}`;

function read(env: string): string[] {
    try {
        const v: unknown = JSON.parse(localStorage.getItem(key(env)) ?? '[]');
        return Array.isArray(v)
            ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX)
            : [];
    } catch {
        return [];
    }
}

/** Last 10 submitted key patterns per connection, newest first (localStorage). */
export function usePatternHistory(env: string) {
    const [state, setState] = useState({ env, items: read(env) });
    const items = state.env === env ? state.items : read(env);

    const push = useCallback(
        (pattern: string) => {
            const p = pattern.trim();
            if (!p) return;
            const next = [p, ...read(env).filter((x) => x !== p)].slice(0, MAX);
            try {
                localStorage.setItem(key(env), JSON.stringify(next));
            } catch {
                // ponytail: storage blocked → history lasts this session only
            }
            setState({ env, items: next });
        },
        [env]
    );

    return { items, push };
}
