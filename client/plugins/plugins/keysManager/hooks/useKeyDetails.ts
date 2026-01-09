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
}

export const useKeyDetails = (
    currentEnvironment: string | null | undefined,
    onKeysSelected?: (keys: string[], pattern?: string) => void
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
    }, [selectedKey, currentEnvironment, showToast]);

    const handleKeySelect = useCallback((key: string) => {
        setSelectedKey(key);
        // Emit event so other plugins know a key was selected
        if (onKeysSelected) {
            onKeysSelected([key]);
        }
    }, [onKeysSelected]);

    return {
        // State
        selectedKey,
        keyDetails,
        isLoadingDetails,

        // Actions
        setSelectedKey,
        setKeyDetails,
        handleKeySelect,
    };
};