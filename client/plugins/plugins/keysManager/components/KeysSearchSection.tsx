import React, { useRef } from 'react';
import styled from 'styled-components';

interface KeysSearchSectionProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSearch: () => void;
    onShowAll: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    currentEnvironment?: string | undefined;
}

const SearchSection = styled.div`
    margin-bottom: 20px;
`;

const SearchBar = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;

    input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
    }

    button {
        padding: 8px 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #f8f9fa;
        cursor: pointer;
        font-size: 14px;

        &:hover:not(:disabled) {
            background-color: #e9ecef;
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        &.secondary-btn {
            background-color: #6c757d;
            color: white;
            border-color: #6c757d;

            &:hover:not(:disabled) {
                background-color: #5a6268;
            }
        }
    }
`;

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