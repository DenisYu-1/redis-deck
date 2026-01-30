import { useState, useEffect, useCallback } from 'react';
import { getKeyDetails as fetchKeyDetails } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { KeyDetails } from '../utils/types';

export interface UseKeyDetailsReturn {
    // State
    selectedKey: string | null;
    keyDetails: KeyDetails | null;
    isLoadingDetails: boolean;

    // Actions
    setSelectedKey: (key: string | null) => void;
    setKeyDetails: (details: KeyDetails | null) => void;
    handleKeySelect: (key: string) => void;
    refreshKey: () => void;
}

export const useKeyDetails = (
    currentEnvironment: string | null | undefined,
    onKeySelected?: (key: string) => void
): UseKeyDetailsReturn => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [keyDetails, setKeyDetails] = useState<KeyDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const { showToast } = useToast();

    // Load key details when selected key changes
    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedKey || !currentEnvironment) {
                setKeyDetails(null);
                return;
            }

            setIsLoadingDetails(true);
            try {
                const details = await fetchKeyDetails(
                    selectedKey,
                    currentEnvironment
                );
                setKeyDetails(details);
            } catch (error) {
                showToast('Error loading key details', 'error');
                console.error('Error loading key details:', error);
            } finally {
                setIsLoadingDetails(false);
            }
        };

        void loadDetails();
    }, [selectedKey, currentEnvironment]);

    const handleKeySelect = useCallback((key: string) => {
        setSelectedKey(key);
        if (onKeySelected) {
            onKeySelected(key);
        }
    }, [onKeySelected]);

    const refreshKey = useCallback(async () => {
        if (!selectedKey || !currentEnvironment) return;

        setIsLoadingDetails(true);
        try {
            const details = await fetchKeyDetails(
                selectedKey,
                currentEnvironment
            );
            setKeyDetails(details);
            showToast('Key refreshed successfully', 'success');
        } catch (error) {
            showToast('Error refreshing key', 'error');
            console.error('Error refreshing key:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    }, [selectedKey, currentEnvironment, showToast]);

    return {
        // State
        selectedKey,
        keyDetails,
        isLoadingDetails,

        // Actions
        setSelectedKey,
        setKeyDetails,
        handleKeySelect,
        refreshKey,
    };
};