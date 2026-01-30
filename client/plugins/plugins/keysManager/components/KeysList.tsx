import React from 'react';
import {
    KeysListContainer,
    KeysResultsList,
    LoadingItem,
    PaginationControls,
    LoadMoreButton
} from './KeysList.styled';

interface KeysListProps {
    keys: string[];
    selectedKey: string | null;
    isLoadingKeys: boolean;
    hasMore: boolean;
    onKeySelect: (key: string) => void;
    onLoadMore: () => void;
}

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