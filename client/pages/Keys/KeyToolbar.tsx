import { useEffect, useRef, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import type { TtlFilter } from '@/types';

export const TYPE_OPTIONS = [
    'string',
    'hash',
    'list',
    'set',
    'zset',
    'stream',
    'json'
] as const;

const TTL_OPTIONS: [TtlFilter, string][] = [
    ['any', 'Any TTL'],
    ['has', 'Has TTL'],
    ['none', 'No TTL'],
    ['lt1h', 'Expires within 1h']
];

interface Props {
    pattern: string;
    type: string;
    ttl: TtlFilter;
    onPattern: (pattern: string) => void;
    onType: (type: string) => void;
    onTtl: (ttl: TtlFilter) => void;
    scanLine: string;
    onNewKey: () => void;
    newKeyDisabled: boolean;
}

const DEBOUNCE_MS = 350;

/** Is the event target somewhere the user types? */
function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return (
        !!el &&
        (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.tagName === 'SELECT' ||
            el.isContentEditable)
    );
}

export function KeyToolbar({
    pattern,
    type,
    ttl,
    onPattern,
    onType,
    onTtl,
    scanLine,
    onNewKey,
    newKeyDisabled
}: Props) {
    const [draft, setDraft] = useState(pattern);
    const input = useRef<HTMLInputElement>(null);

    // A pattern applied from outside (a saved search) replaces the draft.
    const [seen, setSeen] = useState(pattern);
    if (seen !== pattern) {
        setSeen(pattern);
        setDraft(pattern);
    }

    // Debounced apply; Enter applies at once.
    useEffect(() => {
        if (draft === pattern) return;
        const t = setTimeout(() => onPattern(draft), DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [draft, pattern, onPattern]);

    // `/` focuses the search box.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '/' && !isTyping(e.target)) {
                e.preventDefault();
                input.current?.focus();
                input.current?.select();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    return (
        <>
            <div className="toolbar">
                <label className="search">
                    <span className="sr">Key pattern</span>
                    <input
                        ref={input}
                        type="text"
                        value={draft}
                        placeholder="Key pattern, e.g. user:*"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onPattern(draft);
                            if (e.key === 'Escape') input.current?.blur();
                        }}
                    />
                    <span className="mono xs mu">MATCH</span>
                    <kbd>/</kbd>
                </label>
                <label className="sr" htmlFor="ttl-filter">
                    TTL filter
                </label>
                <select
                    id="ttl-filter"
                    className="select ttl-select"
                    value={ttl}
                    onChange={(e) => onTtl(e.target.value as TtlFilter)}
                >
                    {TTL_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn primary"
                    disabled={newKeyDisabled}
                    title={
                        newKeyDisabled
                            ? 'This connection is read-only'
                            : undefined
                    }
                    onClick={onNewKey}
                >
                    New key
                </button>
            </div>
            <div className="chips">
                <div
                    role="group"
                    aria-label="Filter by type"
                    className="type-chips"
                >
                    <Chip on={type === ''} onClick={() => onType('')}>
                        all types
                    </Chip>
                    {TYPE_OPTIONS.map((t) => (
                        <Chip
                            key={t}
                            tone={t}
                            on={type === t}
                            onClick={() => onType(type === t ? '' : t)}
                        >
                            {t}
                        </Chip>
                    ))}
                </div>
                <span className="mono xs mu scanline" role="status">
                    {scanLine}
                </span>
            </div>
        </>
    );
}
