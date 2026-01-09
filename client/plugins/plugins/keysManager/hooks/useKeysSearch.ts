import { useState, useEffect, useCallback, useRef } from 'react';
import { searchKeys, getKeyDetails } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { SearchKeysResult } from '../utils/types';

export interface UseKeysSearchReturn {
    // State
    searchPattern: string;
    inputValue: string;
    searchTrigger: number;
    keys: string[];
    cursors: string[];
    hasMore: boolean;
    isLoadingKeys: boolean;

    // Actions
    setInputValue: (value: string) => void;
    setSearchPattern: (pattern: string) => void;
    triggerSearch: () => void;
    handleSearch: () => Promise<void>;
    handleShowAll: () => void;
    handleLoadMore: () => void;
}

export const useKeysSearch = (
    currentEnvironment: string | null | undefined,
    onKeysSelected?: (keys: string[]) => void
): UseKeysSearchReturn => {
    const [searchPattern, setSearchPattern] = useState('*');
    const [inputValue, setInputValue] = useState('*');
    const [searchTrigger, setSearchTrigger] = useState(0);
    const [keys, setKeys] = useState<string[]>([]);
    const [cursors, setCursors] = useState<string[]>(['0']);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);

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

                    // Auto-select the found key
                    if (onKeysSelected) {
                        onKeysSelected([searchPattern]);
                    }
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
                    if (onKeysSelected) {
                        onKeysSelected([]);
                    }
                    showToast('Key not found', 'warning');
                } else {
                    showToast('Error loading keys', 'error');
                    console.error('Error loading keys:', error);
                }
            } finally {
                setIsLoadingKeys(false);
            }
        },
        [currentEnvironment, cursors, searchPattern, isLoadingKeys, showToast]
    );

    useEffect(() => {
        void loadKeys(true);
    }, [searchTrigger, loadKeys]);

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

                // Auto-select the found key
                if (onKeysSelected) {
                    onKeysSelected([currentValue]);
                }
            } catch (error) {
                // Key doesn't exist
                setKeys([]);
                setCursors(['0']);
                setHasMore(false);
                if (onKeysSelected) {
                    onKeysSelected([]);
                }
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

    return {
        // State
        searchPattern,
        inputValue,
        searchTrigger,
        keys,
        cursors,
        hasMore,
        isLoadingKeys,

        // Actions
        setInputValue,
        setSearchPattern,
        triggerSearch,
        handleSearch,
        handleShowAll,
        handleLoadMore,
    };
};