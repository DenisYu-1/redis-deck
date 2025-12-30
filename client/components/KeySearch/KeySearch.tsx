import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface KeySearchProps {
    onSearch: (pattern: string) => void;
    onShowAll: () => void;
}

export function KeySearch({ onSearch, onShowAll }: KeySearchProps) {
    const [pattern, setPattern] = useState('*');
    const currentEnvironment = useAppStore((state) => state.currentEnvironment);

    const handleSearch = () => {
        if (currentEnvironment) {
            onSearch(pattern);
        }
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
                    type="text"
                    id="search-pattern"
                    placeholder="Key pattern (e.g., user:*, *name*)"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button onClick={handleSearch}>Search</button>
                <button onClick={handleShowAll} className="secondary-btn">
                    Show All Keys
                </button>
            </div>
        </section>
    );
}
