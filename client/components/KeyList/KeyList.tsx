import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { searchKeys } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';

interface KeyListProps {
    searchPattern: string;
    searchTrigger: number;
    onKeySelect: (key: string) => void;
}

export function KeyList({ searchPattern, searchTrigger, onKeySelect }: KeyListProps) {
    const [keys, setKeys] = useState<string[]>([]);
    const [cursors, setCursors] = useState<string[]>(['0']);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { currentEnvironment, selectedKey } = useAppStore();
    const { showToast } = useToast();

    const loadKeys = useCallback(
        async (resetList = false) => {
            const envToUse = currentEnvironment || 'production';
            if (isLoading) return;

            setIsLoading(true);

            // Clear keys immediately when starting a new search
            if (resetList) {
                setKeys([]);
                setCursors(['0']);
                setHasMore(false);
            }

            try {
                const currentCursors = resetList ? ['0'] : cursors;
                const result = await searchKeys(
                    searchPattern,
                    currentCursors,
                    100,
                    envToUse
                );

                if (resetList) {
                    setKeys(result.keys);
                } else {
                    setKeys((prev) => [...prev, ...result.keys]);
                }

                setCursors(result.cursors);
                setHasMore(result.hasMore);
            } catch (error) {
                showToast('Error loading keys', 'error');
                console.error('Error loading keys:', error);
            } finally {
                setIsLoading(false);
            }
        },
        [currentEnvironment, cursors, searchPattern, isLoading, showToast]
    );

    useEffect(() => {
        void loadKeys(true);
    }, [currentEnvironment, searchPattern, searchTrigger]);

    const handleLoadMore = () => {
        void loadKeys(false);
    };

    return (
        <div className="keys-list">
            <h3>
                Keys <span id="keys-count">({keys.length})</span>
                {isLoading && <span> (Searching...)</span>}
            </h3>
            <ul id="keys-results" style={{ opacity: isLoading ? 0.5 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}>
                {keys.map((key) => (
                    <li
                        key={key}
                        className={selectedKey === key ? 'selected' : ''}
                        onClick={() => onKeySelect(key)}
                    >
                        {key}
                    </li>
                ))}
                {isLoading && keys.length === 0 && (
                    <li style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        Searching for keys...
                    </li>
                )}
            </ul>
            <div className="pagination-controls">
                <div className="pagination-status">
                    <span id="pagination-info">Showing {keys.length} keys</span>
                </div>
                <button
                    id="load-more-btn"
                    className="secondary-btn"
                    disabled={!hasMore || isLoading}
                    onClick={handleLoadMore}
                >
                    {isLoading ? 'Loading...' : 'Load More'}
                </button>
            </div>
        </div>
    );
}
