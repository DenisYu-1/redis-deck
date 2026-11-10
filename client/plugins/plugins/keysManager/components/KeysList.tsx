import React from 'react';
import { List, type RowComponentProps } from 'react-window';

import {
    KeysListContainer,
    KeysResultsList,
    KeyRow,
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

interface RowExtraProps {
    keys: string[];
    selectedKey: string | null;
    onKeySelect: (key: string) => void;
}

const Row = ({
    index,
    style,
    keys,
    selectedKey,
    onKeySelect
}: RowComponentProps<RowExtraProps>) => {
    const key = keys[index];
    if (key === undefined) return null;
    return (
        <KeyRow
            style={style}
            className={selectedKey === key ? 'selected' : ''}
            onClick={() => onKeySelect(key)}
            title={key}
        >
            {key}
        </KeyRow>
    );
};

const ROW_HEIGHT = 36;
const MAX_LIST_HEIGHT = 480;

export const KeysList: React.FC<KeysListProps> = ({
    keys,
    selectedKey,
    isLoadingKeys,
    hasMore,
    onKeySelect,
    onLoadMore
}) => {
    // ponytail: virtualized so "Load More" can append thousands of rows without
    // the DOM carrying one node per key. Fixed row height keeps it a one-liner.
    const listHeight = Math.min(keys.length * ROW_HEIGHT, MAX_LIST_HEIGHT);

    return (
        <KeysListContainer className="keys-list">
            <h3>
                Keys <span id="keys-count">({keys.length})</span>
                {isLoadingKeys && <span> (Searching...)</span>}
            </h3>
            <KeysResultsList id="keys-results" $isLoading={isLoadingKeys}>
                {keys.length > 0 && (
                    <List
                        style={{ height: listHeight, width: '100%' }}
                        rowCount={keys.length}
                        rowHeight={ROW_HEIGHT}
                        overscanCount={10}
                        rowComponent={Row}
                        rowProps={{ keys, selectedKey, onKeySelect }}
                    />
                )}
                {isLoadingKeys && keys.length === 0 && (
                    <LoadingItem>Searching for keys...</LoadingItem>
                )}
            </KeysResultsList>
            <PaginationControls className="pagination-controls">
                <div className="pagination-status">
                    <span id="pagination-info">Showing {keys.length} keys</span>
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
