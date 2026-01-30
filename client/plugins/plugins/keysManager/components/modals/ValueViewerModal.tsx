import React, { useRef, useEffect, useState } from 'react';
import type { ValueModalData } from '../../utils/types';

// Import the JSON viewer web component
import '@alenaksu/json-viewer';

// Declare the json-viewer custom element for TypeScript
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'json-viewer': any;
        }
    }
}

interface ValueViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    valueModalData: ValueModalData | null;
    onTabChange: (tab: string) => void;
}

export const ValueViewerModal: React.FC<ValueViewerModalProps> = ({
    isOpen,
    onClose,
    valueModalData,
    onTabChange
}) => {
    const jsonViewerRef = useRef<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchTotalCount, setSearchTotalCount] = useState(0);
    const [searchIndex, setSearchIndex] = useState(-1);

    useEffect(() => {
        if (
            jsonViewerRef.current &&
            valueModalData?.jsonData &&
            valueModalData.activeTab === 'tree'
        ) {
            jsonViewerRef.current.data = valueModalData.jsonData;
            setTimeout(() => {
                if (jsonViewerRef.current?.expandAll) {
                    jsonViewerRef.current.expandAll();
                }
            }, 100);
        }
    }, [valueModalData]);

    useEffect(() => {
        if (valueModalData?.activeTab !== 'tree') {
            setSearchQuery('');
            setSearchTotalCount(0);
            setSearchIndex(-1);
        }
    }, [valueModalData?.activeTab]);

    const handleExpandAll = () => {
        if (jsonViewerRef.current?.expandAll) {
            jsonViewerRef.current.expandAll();
        }
    };

    const handleCollapseAll = () => {
        if (jsonViewerRef.current?.collapseAll) {
            jsonViewerRef.current.collapseAll();
        }
    };

    const navigateToSearchResult = (targetIndex: number) => {
        if (!jsonViewerRef.current || searchTotalCount === 0) {
            return;
        }

        try {
            if (jsonViewerRef.current.expand) {
                try {
                    const expandPattern = new RegExp(searchQuery, 'i');
                    jsonViewerRef.current.expand(expandPattern);
                } catch {
                    jsonViewerRef.current.expand(searchQuery);
                }
            }

            setTimeout(() => {
                const iterator = jsonViewerRef.current.search(searchQuery);
                let currentIndex = 0;
                let result = iterator.next();

                while (!result.done && currentIndex < targetIndex) {
                    result = iterator.next();
                    currentIndex++;
                }

                if (!result.done) {
                    setSearchIndex(targetIndex);
                }
            }, 50);
        } catch (error) {
            console.error('Search navigation error:', error);
        }
    };

    const handleSearch = () => {
        if (!searchQuery.trim() || !jsonViewerRef.current) {
            return;
        }

        try {
            const iterator = jsonViewerRef.current.search(searchQuery);
            let count = 0;
            let result = iterator.next();

            while (!result.done) {
                count++;
                result = iterator.next();
            }

            setSearchTotalCount(count);
            setSearchIndex(0);

            if (count > 0) {
                navigateToSearchResult(0);
            }
        } catch (error) {
            console.error('Search error:', error);
            setSearchTotalCount(0);
            setSearchIndex(-1);
        }
    };

    const handleSearchNext = () => {
        if (searchTotalCount === 0 || searchIndex === -1) {
            return;
        }

        const nextIndex = (searchIndex + 1) % searchTotalCount;
        navigateToSearchResult(nextIndex);
    };

    const handleSearchPrev = () => {
        if (searchTotalCount === 0 || searchIndex === -1) {
            return;
        }

        const prevIndex =
            searchIndex === 0 ? searchTotalCount - 1 : searchIndex - 1;
        navigateToSearchResult(prevIndex);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    if (!isOpen || !valueModalData) return null;

    return (
        <div className="modal" onClick={onClose}>
            <div
                className="modal-content value-viewer-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <span className="close-modal" onClick={onClose}>
                    &times;
                </span>
                <h3>View Value</h3>

                <div className="value-tabs">
                    <button
                        className={`value-tab-btn ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                        onClick={() => onTabChange('formatted')}
                        data-tab="formatted"
                    >
                        Formatted
                    </button>
                    <button
                        className={`value-tab-btn ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                        onClick={() => onTabChange('tree')}
                        data-tab="tree"
                        style={{
                            display: valueModalData.hasJson
                                ? 'inline-block'
                                : 'none'
                        }}
                    >
                        Tree View
                    </button>
                </div>

                {valueModalData.activeTab === 'tree' &&
                    valueModalData.hasJson && (
                        <div className="tree-view-controls">
                            <div className="tree-view-expand-controls">
                                <button
                                    className="tree-control-btn"
                                    onClick={handleExpandAll}
                                    title="Expand All"
                                >
                                    Expand All
                                </button>
                                <button
                                    className="tree-control-btn"
                                    onClick={handleCollapseAll}
                                    title="Collapse All"
                                >
                                    Collapse All
                                </button>
                            </div>
                            <div className="tree-view-search-controls">
                                <input
                                    type="text"
                                    className="tree-search-input"
                                    placeholder="Search in tree..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    onKeyDown={handleSearchKeyDown}
                                />
                                <button
                                    className="tree-control-btn"
                                    onClick={handleSearch}
                                    disabled={!searchQuery.trim()}
                                    title="Search"
                                >
                                    Search
                                </button>
                                {searchTotalCount > 0 && (
                                    <>
                                        <button
                                            className="tree-control-btn"
                                            onClick={handleSearchPrev}
                                            disabled={searchTotalCount === 0}
                                            title="Previous"
                                        >
                                            Prev
                                        </button>
                                        <span className="tree-search-info">
                                            {searchIndex + 1} /{' '}
                                            {searchTotalCount}
                                        </span>
                                        <button
                                            className="tree-control-btn"
                                            onClick={handleSearchNext}
                                            disabled={searchTotalCount === 0}
                                            title="Next"
                                        >
                                            Next
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                <div className="value-viewer-container">
                    <pre
                        className={`value-viewer-raw value-tab-content ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                        data-content="formatted"
                    >
                        {valueModalData.formatted}
                    </pre>
                    <json-viewer
                        ref={jsonViewerRef}
                        className={`value-tab-content ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                        data-content="tree"
                        style={{
                            display:
                                valueModalData.activeTab === 'tree'
                                    ? 'block'
                                    : 'none'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
