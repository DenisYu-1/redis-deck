import { useEffect, useState } from 'react';
import {
    createSavedSearch,
    deleteSavedSearch,
    listSavedSearches,
    type SavedSearch
} from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { showToast } from '@/utils/toast';

/** Sidebar group on the Keys route: save the current pattern, click to apply. */
export function SavedSearches() {
    const env = useAppStore((s) => s.currentEnvironment);
    const tier = useAppStore(
        (s) => s.connections.find((c) => c.id === s.currentEnvironment)?.tier
    );
    const pattern = useAppStore((s) => s.keyPattern);
    const setPattern = useAppStore((s) => s.setKeyPattern);
    const [loaded, setLoaded] = useState<{
        env: string;
        items: SavedSearch[];
    } | null>(null);
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const items = loaded?.env === env ? loaded.items : [];

    useEffect(() => {
        if (!env) return;
        let cancelled = false;
        listSavedSearches(env)
            .then((l) => !cancelled && setLoaded({ env, items: l }))
            .catch(() => !cancelled && setLoaded({ env, items: [] }));
        return () => {
            cancelled = true;
        };
    }, [env]);

    if (!env) return null;

    const save = () => {
        const label = name.trim();
        if (!label) return;
        createSavedSearch(env, label, pattern)
            .then((s) => {
                setLoaded({ env, items: [...items, s] });
                setNaming(false);
                setName('');
            })
            .catch((e: unknown) =>
                showToast(
                    e instanceof Error ? e.message : 'Could not save search',
                    'error'
                )
            );
    };

    const remove = (s: SavedSearch) => {
        deleteSavedSearch(env, s.id)
            .then(() =>
                setLoaded({ env, items: items.filter((i) => i.id !== s.id) })
            )
            .catch((e: unknown) =>
                showToast(
                    e instanceof Error ? e.message : 'Could not delete search',
                    'error'
                )
            );
    };

    return (
        <div className="navgroup" role="group" aria-label="Saved searches">
            <div className="navhead">
                <span>Saved searches</span>
                <button
                    type="button"
                    className="btn xs"
                    aria-label="Save current pattern"
                    onClick={() => {
                        setNaming(true);
                        setName('');
                    }}
                >
                    +
                </button>
            </div>
            {naming && (
                <form
                    className="saved-new"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <input
                        autoFocus
                        className="input"
                        aria-label="Search name"
                        placeholder={`Name for ${pattern}`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setNaming(false);
                        }}
                    />
                </form>
            )}
            {items.map((s) => (
                <div key={s.id} className="saved-row">
                    <button
                        type="button"
                        className={`navitem ${s.pattern === pattern ? 'on' : ''}`}
                        title={s.pattern}
                        onClick={() => setPattern(s.pattern)}
                    >
                        <span>{s.name}</span>
                        {tier === 'production' && (
                            <span className="env production">prod</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className="saved-del"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => remove(s)}
                    >
                        ×
                    </button>
                </div>
            ))}
            {items.length === 0 && !naming && (
                <span className="mono xs mu saved-empty">
                    No saved searches
                </span>
            )}
        </div>
    );
}
