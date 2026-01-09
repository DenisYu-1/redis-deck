import React, { useRef } from 'react';
import { SearchSection, SearchBar } from './KeysSearchSection.styled';

interface KeysSearchSectionProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSearch: () => void;
    onShowAll: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    currentEnvironment?: string | undefined;
}

export const KeysSearchSection: React.FC<KeysSearchSectionProps> = ({
    inputValue,
    onInputChange,
    onSearch,
    onShowAll,
    onKeyDown,
    currentEnvironment,
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);

    return (
        <SearchSection className="search-section" data-priority="0">
            <h2>Search Keys</h2>
            <SearchBar className="search-bar">
                <input
                    ref={searchInputRef}
                    type="text"
                    id="search-pattern"
                    placeholder="Key pattern (e.g., user:*, *name*)"
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <button
                    type="button"
                    onClick={onSearch}
                    disabled={!currentEnvironment}
                >
                    Search
                </button>
                <button onClick={onShowAll} className="secondary-btn">
                    Show All Keys
                </button>
            </SearchBar>
        </SearchSection>
    );
};