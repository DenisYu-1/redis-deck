import { useCallback, useEffect, useRef, useState } from 'react';
import { getKeyDetails, searchKeys } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { SearchKeysResult } from '../utils/types';

const SEARCH_HISTORY_KEY = 'redis-search-history';
const MAX_HISTORY_ITEMS = 10;

export interface UseKeysSearchReturn {
    // State
    searchPattern: string;
    inputValue: string;
    searchTrigger: number;
    keys: string[];
    cursors: string[];
    hasMore: boolean;
    isLoadingKeys: boolean;
    searchHistory: string[];

    // Actions
    setInputValue: (value: string) => void;
    setSearchPattern: (pattern: string) => void;
    triggerSearch: () => void;
    handleSearch: () => Promise<void>;
    handleShowAll: () => void;
    handleLoadMore: () => void;
    handleHistorySelect: (pattern: string) => void;
    addPatternToHistory: (pattern: string) => void;
}

const loadHistoryFromStorage = (): string[] => {
    try {
        const stored = sessionStorage.getItem(SEARCH_HISTORY_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as string[];
            return Array.isArray(parsed) ? parsed : [];
        }
    } catch (error) {
        console.error('Failed to load search history from storage:', error);
    }
    return [];
};

const saveHistoryToStorage = (history: string[]): void => {
    try {
        sessionStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.error('Failed to save search history to storage:', error);
    }
};

const addToHistory = (pattern: string, currentHistory: string[]): string[] => {
    const trimmed = pattern.trim();
    if (!trimmed) {
        return currentHistory;
    }

    const filtered = currentHistory.filter((item) => item !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    saveHistoryToStorage(updated);
    return updated;
};

export const useKeysSearch = (
    currentEnvironment: string | null | undefined
): UseKeysSearchReturn => {
    const [searchPattern, setSearchPattern] = useState('*');
    const [inputValue, setInputValue] = useState('*');
    const [searchTrigger, setSearchTrigger] = useState(0);
    const [keys, setKeys] = useState<string[]>([]);
    const [cursors, setCursors] = useState<string[]>(['0']);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>(() =>
        loadHistoryFromStorage()
    );

    const { showToast } = useToast();
    const abortControllerRef = useRef<AbortController | null>(null);

    const loadKeys = useCallback(
        async (resetList = false) => {
            const envToUse = currentEnvironment || 'production';
            if (isLoadingKeys) return;

            // Cancel any previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController for this request
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            setIsLoadingKeys(true);

            // Clear keys immediately when starting a new search
            if (resetList) {
                setKeys([]);
                setCursors(['0']);
                setHasMore(false);
            }

            // Check if this is a direct key search (no wildcards)
            const hasWildcards =
                searchPattern.includes('*') ||
                searchPattern.includes('?') ||
                searchPattern.includes('[');

            try {
                if (!hasWildcards && searchPattern.trim() !== '' && resetList) {
                    // This is a direct key lookup - check if key exists
                    await getKeyDetails(searchPattern, envToUse);
                    // Key exists - show it in the list
                    setKeys([searchPattern]);
                    setCursors(['0']);
                    setHasMore(false);

                    // Don't call onKeysSelected here - this is for external key selections only
                } else if (hasWildcards || searchPattern.trim() === '') {
                    // This is a pattern search - use SCAN
                    const currentCursors = resetList ? ['0'] : cursors;
                    const result: SearchKeysResult = await searchKeys(
                        searchPattern,
                        currentCursors,
                        100,
                        envToUse,
                        signal
                    );

                    if (resetList) {
                        setKeys(result.keys);
                    } else {
                        setKeys((prev) => [...prev, ...result.keys]);
                    }

                    setCursors(result.cursors);
                    setHasMore(result.hasMore);
                } else {
                    // For non-reset loads with exact key search, do nothing (pagination not supported)
                    setIsLoadingKeys(false);
                    return;
                }
            } catch (error) {
                // Don't show error if request was aborted
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                if (!hasWildcards && searchPattern.trim() !== '' && resetList) {
                    // Key doesn't exist for exact search
                    setKeys([]);
                    setCursors(['0']);
                    setHasMore(false);
                    showToast('Key not found', 'warning');
                } else {
                    showToast('Error loading keys', 'error');
                    console.error('Error loading keys:', error);
                }
            } finally {
                setIsLoadingKeys(false);
            }
        },
        [currentEnvironment, cursors, searchPattern, isLoadingKeys]
    );

    useEffect(() => {
        void loadKeys(true);
    }, [searchTrigger]); // Removed loadKeys to prevent infinite loops

    // Cleanup effect to cancel any ongoing requests when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const triggerSearch = useCallback(() => {
        setSearchTrigger((prev) => prev + 1);
    }, []);

    const handleSearch = async () => {
        // Get the current value from the input
        const currentValue = inputValue.trim();

        // Update searchPattern with the current input value
        setSearchPattern(currentValue);

        // Add to history if not empty
        if (currentValue) {
            setSearchHistory((prev) => addToHistory(currentValue, prev));
        }

        // Check if this is a direct key search (no wildcards)
        const hasWildcards =
            currentValue.includes('*') ||
            currentValue.includes('?') ||
            currentValue.includes('[');

        if (!hasWildcards && currentValue !== '') {
            // This is a direct key lookup - check if key exists
            const envToUse = currentEnvironment || 'production';
            setIsLoadingKeys(true);
            try {
                await getKeyDetails(currentValue, envToUse);
                // Key exists - show it in the list
                setKeys([currentValue]);
                setCursors(['0']);
                setHasMore(false);

                // Auto-select the found key (don't call onKeysSelected here to avoid loops)
                // The onKeysSelected callback is for external key selections, not internal ones
            } catch (error) {
                // Key doesn't exist
                setKeys([]);
                setCursors(['0']);
                setHasMore(false);
                showToast('Key not found', 'warning');
            } finally {
                setIsLoadingKeys(false);
            }
        } else {
            // This is a pattern search - trigger the useEffect to load keys
            triggerSearch();
        }
    };

    const handleShowAll = () => {
        setInputValue('*');
        setSearchPattern('*');
        triggerSearch();
    };

    const handleLoadMore = () => {
        void loadKeys(false);
    };

    const handleHistorySelect = useCallback(
        (pattern: string) => {
            setInputValue(pattern);
            setSearchPattern(pattern);
            setSearchHistory((prev) => addToHistory(pattern, prev));
            triggerSearch();
        },
        [triggerSearch]
    );

    const addPatternToHistory = useCallback((pattern: string) => {
        setSearchHistory((prev) => addToHistory(pattern, prev));
    }, []);

    return {
        // State
        searchPattern,
        inputValue,
        searchTrigger,
        keys,
        cursors,
        hasMore,
        isLoadingKeys,
        searchHistory,

        // Actions
        setInputValue,
        setSearchPattern,
        triggerSearch,
        handleSearch,
        handleShowAll,
        handleLoadMore,
        handleHistorySelect,
        addPatternToHistory
    };
};
