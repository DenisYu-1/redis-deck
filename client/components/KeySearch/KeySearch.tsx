import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface KeySearchProps {
    searchPattern: string;
    onSearch: (pattern: string) => void;
    onShowAll: () => void;
}

export function KeySearch({ searchPattern, onSearch, onShowAll }: KeySearchProps) {
    const [pattern, setPattern] = useState(searchPattern);
    const currentEnvironment = useAppStore((state) => state.currentEnvironment);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state with searchPattern prop
    useEffect(() => {
        setPattern(searchPattern);
    }, [searchPattern]);

    const handleSearch = () => {
        // Get the current value from the input in case it was modified externally
        const currentValue = inputRef.current?.value || pattern;
        if (currentValue !== pattern) {
            setPattern(currentValue);
        }
        onSearch(currentValue);
    };

    const handleShowAll = () => {
        setPattern('*');
        onShowAll();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <section className="search-section" data-priority="0">
            <h2>Search Keys</h2>
            <div className="search-bar">
                <input
                    ref={inputRef}
                    type="text"
                    id="search-pattern"
                    placeholder="Key pattern (e.g., user:*, *name*)"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button type="button" onClick={handleSearch} disabled={!currentEnvironment}>Search</button>
                <button onClick={handleShowAll} className="secondary-btn">
                    Show All Keys
                </button>
            </div>
        </section>
    );
}
