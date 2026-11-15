import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getKeySizes } from '@/services/apiService';
import type { KeyMeta } from '@/types';

const MAX_PER_REQUEST = 500; // server cap on POST /keys/sizes

type Sizes = ReadonlyMap<KeyMeta, number | null>;

/**
 * Clustered Connections leave `size` out of the Page meta (SPEC R4). Fetch it
 * for the rows on screen only, once per row. Sizes hang off the meta entry
 * object, so a refreshed page (new entries) refetches and stale sizes never
 * leak across searches or Connections.
 */
export function useLazySizes(
    env: string | null,
    meta: Record<string, KeyMeta>
) {
    const [sizes, setSizes] = useState<Sizes>(new Map());
    const requested = useRef(new WeakSet<KeyMeta>()); // fetched or in flight
    const metaRef = useRef(meta);
    const visible = useRef<string[]>([]);

    const request = useCallback(
        (keys: string[]) => {
            visible.current = keys;
            if (!env) return;
            const want: { key: string; entry: KeyMeta }[] = [];
            for (const key of keys) {
                const entry = metaRef.current[key];
                if (
                    entry &&
                    entry.size === undefined &&
                    !requested.current.has(entry)
                ) {
                    requested.current.add(entry);
                    want.push({ key, entry });
                }
            }
            for (let i = 0; i < want.length; i += MAX_PER_REQUEST) {
                const chunk = want.slice(i, i + MAX_PER_REQUEST);
                void getKeySizes(
                    chunk.map(({ key, entry }) => ({ key, node: entry.node })),
                    env
                )
                    .catch(() => ({}) as Record<string, number | null>)
                    .then((got) =>
                        setSizes((prev) => {
                            // Drop entries of earlier pages.
                            const live = new Set(
                                Object.values(metaRef.current)
                            );
                            const next = new Map(
                                [...prev].filter(([m]) => live.has(m))
                            );
                            for (const { key, entry } of chunk) {
                                next.set(entry, got[key] ?? null);
                            }
                            return next;
                        })
                    );
            }
        },
        [env]
    );

    // Rows already on screen when their meta arrives.
    useEffect(() => {
        metaRef.current = meta;
        request(visible.current);
    }, [meta, request]);

    const merged = useMemo(() => {
        const out: Record<string, KeyMeta> = {};
        for (const [key, m] of Object.entries(meta)) {
            out[key] = sizes.has(m) ? { ...m, size: sizes.get(m) ?? null } : m;
        }
        return out;
    }, [meta, sizes]);

    return { meta: merged, onVisibleKeys: request };
}
