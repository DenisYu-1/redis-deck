import { useState } from 'react';
import type { KeyType, ZSetMember } from '../utils/types';

export interface UseAddKeyFormReturn {
    // Form state
    isAddFormExpanded: boolean;
    keyName: string;
    keyType: KeyType;
    stringValue: string;
    zsetMembers: ZSetMember[];
    zsetRawValue: string;
    expiry: string;

    // Actions
    setIsAddFormExpanded: (expanded: boolean) => void;
    setKeyName: (name: string) => void;
    setKeyType: (type: KeyType) => void;
    setStringValue: (value: string) => void;
    setZsetRawValue: (value: string) => void;
    setExpiry: (expiry: string) => void;

    // ZSet member management
    handleAddZsetMember: () => void;
    handleRemoveZsetMember: (index: number) => void;
    updateZsetMember: (
        index: number,
        field: keyof ZSetMember,
        value: string | number
    ) => void;
    handleParseZsetRawValue: (emit: any) => Promise<void>;

    // Form actions
    handleSaveKey: (context: any, emit: any) => Promise<void>;
    clearForm: () => void;
}

export const useAddKeyForm = (
    onOperationComplete: () => void
): UseAddKeyFormReturn => {
    // Add/Update Key form state
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [keyType, setKeyType] = useState<KeyType>('string');
    const [stringValue, setStringValue] = useState('');
    const [zsetMembers, setZsetMembers] = useState<ZSetMember[]>([
        { score: 0, value: '' }
    ]);
    const [zsetRawValue, setZsetRawValue] = useState('');
    const [expiry, setExpiry] = useState('');

    const handleAddZsetMember = () => {
        setZsetMembers((prev) => [...prev, { score: 0, value: '' }]);
    };

    const handleRemoveZsetMember = (index: number) => {
        if (zsetMembers.length > 1) {
            setZsetMembers((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const updateZsetMember = (
        index: number,
        field: keyof ZSetMember,
        value: string | number
    ) => {
        setZsetMembers((prev) =>
            prev.map((member, i) =>
                i === index ? { ...member, [field]: value } : member
            )
        );
    };

    const handleParseZsetRawValue = async (emit: any) => {
        const rawValue = zsetRawValue.trim();
        if (!rawValue) {
            emit({
                type: 'toast:show',
                payload: {
                    message: 'Paste a zset value to parse',
                    type: 'error'
                },
                source: 'keys-manager'
            });
            return;
        }

        try {
            const { parseZsetMembersFromText } =
                await import('../utils/valueUtils');
            const result = parseZsetMembersFromText(rawValue);

            if (result.members.length === 0) {
                emit({
                    type: 'toast:show',
                    payload: {
                        message: 'No valid zset members found in pasted value',
                        type: 'error'
                    },
                    source: 'keys-manager'
                });
                return;
            }

            setZsetMembers(result.members);
            setZsetRawValue('');

            if (result.invalidScores > 0 || result.hasDanglingMember) {
                emit({
                    type: 'toast:show',
                    payload: {
                        message:
                            'Some entries were skipped due to invalid scores',
                        type: 'error'
                    },
                    source: 'keys-manager'
                });
            }
        } catch (error: any) {
            emit({
                type: 'toast:show',
                payload: {
                    message: error.message || 'Failed to parse zset value',
                    type: 'error'
                },
                source: 'keys-manager'
            });
        }
    };

    const handleSaveKey = async (context: any, emit: any) => {
        if (!keyName.trim()) {
            emit({
                type: 'toast:show',
                payload: { message: 'Key is required', type: 'error' },
                source: 'keys-manager'
            });
            return;
        }

        try {
            const environment = context.getCurrentEnvironment();
            const expiryValue = expiry.trim() ? parseInt(expiry) : null;

            if (keyType === 'string') {
                if (!stringValue.trim()) {
                    emit({
                        type: 'toast:show',
                        payload: {
                            message: 'Value is required',
                            type: 'error'
                        },
                        source: 'keys-manager'
                    });
                    return;
                }

                await import('@/services/apiService').then(({ saveKey }) =>
                    saveKey(keyName, stringValue, expiryValue, environment)
                );
                setStringValue('');
            } else if (keyType === 'zset') {
                const validMembers = zsetMembers.filter(
                    (member) =>
                        member.score !== undefined && member.value.trim() !== ''
                );

                if (validMembers.length === 0) {
                    emit({
                        type: 'toast:show',
                        payload: {
                            message:
                                'At least one member is required for a sorted set',
                            type: 'error'
                        },
                        source: 'keys-manager'
                    });
                    return;
                }

                await import('@/services/apiService').then(
                    ({ addToSortedSet }) =>
                        addToSortedSet(
                            keyName,
                            validMembers,
                            expiryValue,
                            environment
                        )
                );
                setZsetMembers([{ score: 0, value: '' }]);
                setZsetRawValue('');
            } else {
                emit({
                    type: 'toast:show',
                    payload: {
                        message: `Support for ${keyType} keys is not implemented yet`,
                        type: 'error'
                    },
                    source: 'keys-manager'
                });
                return;
            }

            emit({
                type: 'toast:show',
                payload: {
                    message: `Key "${keyName}" saved successfully`,
                    type: 'success'
                },
                source: 'keys-manager'
            });

            // Reset form
            setKeyName('');
            setExpiry('');
            setKeyType('string');

            // Emit operation complete to refresh key list
            onOperationComplete();
        } catch (error: any) {
            emit({
                type: 'toast:show',
                payload: { message: error.message, type: 'error' },
                source: 'keys-manager'
            });
        }
    };

    const clearForm = () => {
        setKeyName('');
        setKeyType('string');
        setStringValue('');
        setZsetMembers([{ score: 0, value: '' }]);
        setZsetRawValue('');
        setExpiry('');
    };

    return {
        // Form state
        isAddFormExpanded,
        keyName,
        keyType,
        stringValue,
        zsetMembers,
        zsetRawValue,
        expiry,

        // Actions
        setIsAddFormExpanded,
        setKeyName,
        setKeyType,
        setStringValue,
        setZsetRawValue,
        setExpiry,

        // ZSet member management
        handleAddZsetMember,
        handleRemoveZsetMember,
        updateZsetMember,
        handleParseZsetRawValue,

        // Form actions
        handleSaveKey,
        clearForm
    };
};
