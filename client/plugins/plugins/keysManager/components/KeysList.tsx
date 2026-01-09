import React from 'react';
import styled from 'styled-components';

interface KeysListProps {
    keys: string[];
    selectedKey: string | null;
    isLoadingKeys: boolean;
    hasMore: boolean;
    onKeySelect: (key: string) => void;
    onLoadMore: () => void;
}

const KeysListContainer = styled.div`
    flex: 1;
`;

const KeysResultsList = styled.ul<{ $isLoading: boolean }>`
    opacity: ${props => props.$isLoading ? 0.5 : 1};
    pointer-events: ${props => props.$isLoading ? 'none' : 'auto'};
    list-style: none;
    padding: 0;
    margin: 0;

    li {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;

        &:hover {
            background-color: #f8f9fa;
        }

        &.selected {
            background-color: #e3f2fd;
            font-weight: bold;
        }
    }
`;

const LoadingItem = styled.li`
    text-align: center;
    padding: 20px;
    color: #666;
`;

const PaginationControls = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
`;

const LoadMoreButton = styled.button`
    padding: 8px 16px;
    background-color: #6c757d;
    color: white;
    border: 1px solid #6c757d;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;

    &:hover:not(:disabled) {
        background-color: #5a6268;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

export const KeysList: React.FC<KeysListProps> = ({
    keys,
    selectedKey,
    isLoadingKeys,
    hasMore,
    onKeySelect,
    onLoadMore,
}) => {
    return (
        <KeysListContainer className="keys-list">
            <h3>
                Keys <span id="keys-count">({keys.length})</span>
                {isLoadingKeys && <span> (Searching...)</span>}
            </h3>
            <KeysResultsList id="keys-results" $isLoading={isLoadingKeys}>
                {keys.map((key) => (
                    <li
                        key={key}
                        className={
                            selectedKey === key ? 'selected' : ''
                        }
                        onClick={() => onKeySelect(key)}
                    >
                        {key}
                    </li>
                ))}
                {isLoadingKeys && keys.length === 0 && (
                    <LoadingItem>
                        Searching for keys...
                    </LoadingItem>
                )}
            </KeysResultsList>
            <PaginationControls className="pagination-controls">
                <div className="pagination-status">
                    <span id="pagination-info">
                        Showing {keys.length} keys
                    </span>
                </div>
                <LoadMoreButton
                    id="load-more-btn"
                    className="secondary-btn"
                    disabled={!hasMore || isLoadingKeys}
                    onClick={onLoadMore}
                >
                    {isLoadingKeys ? 'Loading...' : 'Load More'}
                </LoadMoreButton>
            </PaginationControls>
        </KeysListContainer>
    );
};