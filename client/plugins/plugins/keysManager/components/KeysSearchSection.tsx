import React, { useRef, useState, useEffect } from 'react';
import {
    SearchSection,
    SearchBar,
    HistoryButton,
    HistoryPopup,
    HistoryList,
    HistoryItem,
    EmptyState
} from './KeysSearchSection.styled';

interface KeysSearchSectionProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSearch: () => void;
    onShowAll: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    currentEnvironment?: string | undefined;
    searchHistory: string[];
    onHistorySelect: (pattern: string) => void;
}

export const KeysSearchSection: React.FC<KeysSearchSectionProps> = ({
    inputValue,
    onInputChange,
    onSearch,
    onShowAll,
    onKeyDown,
    currentEnvironment,
    searchHistory,
    onHistorySelect
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const historyButtonRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popupRef.current &&
                historyButtonRef.current &&
                !popupRef.current.contains(event.target as Node) &&
                !historyButtonRef.current.contains(event.target as Node)
            ) {
                setShowHistory(false);
            }
        };

        if (showHistory) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHistory]);

    const handleHistoryClick = (pattern: string) => {
        onHistorySelect(pattern);
        setShowHistory(false);
    };

    return (
        <SearchSection className="search-section" data-priority="0">
            <h2>Search Keys</h2>
            <SearchBar className="search-bar">
                <HistoryButton
                    ref={historyButtonRef}
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    title="Search History"
                >
                    ⌄
                </HistoryButton>
                {showHistory && (
                    <HistoryPopup ref={popupRef}>
                        {searchHistory.length === 0 ? (
                            <EmptyState>History is empty</EmptyState>
                        ) : (
                            <HistoryList>
                                {searchHistory.map((item, index) => (
                                    <HistoryItem
                                        key={`${item}-${index}`}
                                        onClick={() => handleHistoryClick(item)}
                                    >
                                        {item}
                                    </HistoryItem>
                                ))}
                            </HistoryList>
                        )}
                    </HistoryPopup>
                )}
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
                    className="search-btn"
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
