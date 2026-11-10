import React from 'react';
import { FixedSizeList as RawFixedSizeList } from 'react-window';

// @types/react-window 1.x predates React 18's Component type tightening, so its
// class type isn't a valid JSX component. Re-type it with just the props we use.
interface VirtualRowProps {
    index: number;
    style: React.CSSProperties;
}
const FixedSizeList = RawFixedSizeList as unknown as React.FC<{
    height: number;
    width: string | number;
    itemCount: number;
    itemSize: number;
    overscanCount?: number;
    children: (props: VirtualRowProps) => React.ReactNode;
}>;
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
                    <FixedSizeList
                        height={listHeight}
                        width="100%"
                        itemCount={keys.length}
                        itemSize={ROW_HEIGHT}
                        overscanCount={10}
                    >
                        {({ index, style }) => {
                            const key = keys[index];
                            if (key === undefined) return null;
                            return (
                                <KeyRow
                                    style={style}
                                    className={
                                        selectedKey === key ? 'selected' : ''
                                    }
                                    onClick={() => onKeySelect(key)}
                                    title={key}
                                >
                                    {key}
                                </KeyRow>
                            );
                        }}
                    </FixedSizeList>
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
