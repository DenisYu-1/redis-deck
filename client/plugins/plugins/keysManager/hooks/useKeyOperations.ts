import { useCallback } from 'react';
import {
    deleteKey,
    setTTL,
    renameKey,
    copyKey,
    getKeyDetails
} from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { KeyDetails } from '../utils/types';

export interface UseKeyOperationsReturn {
    // Actions
    handleDelete: () => Promise<void>;
    handleSetTTL: (ttlValue: string) => Promise<void>;
    handleRename: (newKeyName: string) => Promise<void>;
    handleCopy: (targetKeyName: string, targetEnv: string) => Promise<void>;
}

export const useKeyOperations = (
    selectedKey: string | null,
    currentEnvironment: string | null | undefined,
    onOperationComplete: () => void,
    setSelectedKey: (key: string | null) => void,
    setKeyDetails: (details: KeyDetails | null) => void
): UseKeyOperationsReturn => {
    const { showToast } = useToast();

    const handleOperationComplete = useCallback(() => {
        // Refresh keys list and key details
        onOperationComplete();
        if (selectedKey) {
            // Reload details for the selected key
            const loadDetails = async () => {
                try {
                    if (!currentEnvironment) return;
                    const details = await getKeyDetails(
                        selectedKey,
                        currentEnvironment
                    );
                    setKeyDetails(details);
                } catch (error) {
                    console.error('Error reloading key details:', error);
                }
            };
            void loadDetails();
        }
    }, [selectedKey, currentEnvironment, onOperationComplete, setKeyDetails]);

    // Key operations handlers
    const handleDelete = async () => {
        if (!selectedKey || !currentEnvironment) return;

        if (!confirm(`Are you sure you want to delete key "${selectedKey}"?`)) {
            return;
        }

        try {
            await deleteKey(selectedKey, currentEnvironment);
            showToast('Key deleted successfully', 'success');
            setKeyDetails(null);
            setSelectedKey(null);
            handleOperationComplete();
        } catch (error) {
            showToast('Error deleting key', 'error');
            console.error('Error deleting key:', error);
        }
    };

    const handleSetTTL = async (ttlValue: string) => {
        if (!selectedKey || !currentEnvironment) return;

        const seconds = parseInt(ttlValue, 10);
        if (isNaN(seconds)) {
            showToast('Invalid TTL value', 'error');
            return;
        }

        try {
            await setTTL(selectedKey, seconds, currentEnvironment);
            showToast('TTL set successfully', 'success');
            handleOperationComplete();
        } catch (error) {
            showToast('Error setting TTL', 'error');
            console.error('Error setting TTL:', error);
        }
    };

    const handleRename = async (newKeyName: string) => {
        if (!selectedKey || !currentEnvironment || !newKeyName) return;

        try {
            await renameKey(selectedKey, newKeyName, currentEnvironment);
            showToast('Key renamed successfully', 'success');
            setSelectedKey(newKeyName); // Update selected key to the new name
            handleOperationComplete();
        } catch (error) {
            showToast('Error renaming key', 'error');
            console.error('Error renaming key:', error);
        }
    };

    const handleCopy = async (targetKeyName: string, targetEnv: string) => {
        if (!selectedKey || !currentEnvironment || !targetKeyName || !targetEnv)
            return;

        try {
            await copyKey(
                selectedKey,
                targetKeyName,
                currentEnvironment,
                targetEnv
            );
            showToast('Key copied successfully', 'success');
            handleOperationComplete();
        } catch (error) {
            showToast('Error copying key', 'error');
            console.error('Error copying key:', error);
        }
    };

    return {
        handleDelete,
        handleSetTTL,
        handleRename,
        handleCopy,
    };
};