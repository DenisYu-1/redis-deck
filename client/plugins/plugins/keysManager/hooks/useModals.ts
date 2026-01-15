import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { ValueModalData } from '../utils/types';

export interface UseModalsReturn {
    // Modal visibility state
    showTTLModal: boolean;
    showRenameModal: boolean;
    showCopyModal: boolean;
    showValueModal: boolean;

    // Modal data state
    valueModalData: ValueModalData | null;
    ttlValue: string;
    newKeyName: string;
    targetKeyName: string;
    targetEnv: string;

    // Actions
    setShowTTLModal: (show: boolean) => void;
    setShowRenameModal: (show: boolean) => void;
    setShowCopyModal: (show: boolean) => void;
    setShowValueModal: (show: boolean) => void;
    setValueModalData: (data: ValueModalData | null) => void;
    setTtlValue: (value: string) => void;
    setNewKeyName: (name: string) => void;
    setTargetKeyName: (name: string) => void;
    setTargetEnv: (env: string) => void;

    // Modal handlers
    handleTabChange: (tab: string) => void;
}

export const useModals = (): UseModalsReturn => {
    const [showTTLModal, setShowTTLModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [showValueModal, setShowValueModal] = useState(false);
    const [valueModalData, setValueModalData] = useState<ValueModalData | null>(null);
    const [ttlValue, setTtlValue] = useState('');
    const [newKeyName, setNewKeyName] = useState('');
    const [targetKeyName, setTargetKeyName] = useState('');
    const [targetEnv, setTargetEnv] = useState('');

    const { currentEnvironment } = useAppStore();

    // Sync target environment with current environment
    useEffect(() => {
        setTargetEnv(currentEnvironment ?? '');
    }, [currentEnvironment]);

    const handleTabChange = (tab: string) => {
        if (!valueModalData) return;
        setValueModalData((prev) =>
            prev ? { ...prev, activeTab: tab } : null
        );
    };

    return {
        // Modal visibility state
        showTTLModal,
        showRenameModal,
        showCopyModal,
        showValueModal,

        // Modal data state
        valueModalData,
        ttlValue,
        newKeyName,
        targetKeyName,
        targetEnv,

        // Actions
        setShowTTLModal,
        setShowRenameModal,
        setShowCopyModal,
        setShowValueModal,
        setValueModalData,
        setTtlValue,
        setNewKeyName,
        setTargetKeyName,
        setTargetEnv,

        // Modal handlers
        handleTabChange,
    };
};