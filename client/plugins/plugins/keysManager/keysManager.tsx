import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { PluginComponentProps } from '../../types';

// Hooks
import { useKeysSearch } from './hooks/useKeysSearch';
import { useKeyDetails } from './hooks/useKeyDetails';
import { useKeyOperations } from './hooks/useKeyOperations';
import { useAddKeyForm } from './hooks/useAddKeyForm';
import { useModals } from './hooks/useModals';

// Types
// Components
import { KeysSearchSection } from './components/KeysSearchSection';
import { KeysList } from './components/KeysList';
import { KeyDetails } from './components/KeyDetails';
import { AddKeyForm } from './components/AddKeyForm';
import {
    CopyModal,
    RenameModal,
    TTLModal,
    ValueViewerModal
} from './components/modals';

// Styles
import { Container, KeysRow } from './styled';

const KeysManagerPlugin: React.FC<PluginComponentProps> = ({
    context,
    emit,
    on
}) => {
    const { currentEnvironment, connections } = useAppStore();

    // Memoized callbacks to prevent infinite re-renders
    useCallback(
        (keys: string[]) => {
            if (keys.length > 0) {
                emit({
                    type: 'keys:selected',
                    payload: { keys },
                    source: 'keys-manager'
                });
            }
        },
        [emit]
    );
    const keysSearch = useKeysSearch(currentEnvironment);

    const keyDetails = useKeyDetails(currentEnvironment, (key) => {
        // Emit event when key is selected from the list
        emit({
            type: 'keys:selected',
            payload: { keys: [key] },
            source: 'keys-manager'
        });
    });

    const operationCompleteCallback = useCallback(() => {
        keysSearch.triggerSearch();
        emit({
            type: 'operation:completed',
            source: 'keys-manager'
        });
    }, [keysSearch, emit]);

    const keyOperations = useKeyOperations(
        keyDetails.selectedKey,
        currentEnvironment,
        operationCompleteCallback,
        keyDetails.setSelectedKey,
        keyDetails.setKeyDetails
    );

    const addKeyForm = useAddKeyForm(() => {
        keysSearch.triggerSearch();
        emit({
            type: 'operation:completed',
            source: 'keys-manager'
        });
    });

    const modals = useModals();

    // Ref to store the unsubscribe function
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Event handlers
    const handleViewValue = (value: unknown, type: string) => {
        import('./utils/valueUtils')
            .then(({ prepareValueForViewer }) => {
                try {
                    const valueModalData = prepareValueForViewer(value, type);
                    modals.setValueModalData(valueModalData);
                    modals.setShowValueModal(true);
                } catch (error) {
                    showToast('Failed to display value', 'error');
                }
            })
            .catch(() => {
                showToast('Failed to load utilities', 'error');
            });
    };

    const handleCopyValue = (value: unknown) => {
        import('./utils/valueUtils')
            .then(({ copyValueToClipboard }) => {
                copyValueToClipboard(value)
                    .then(() => {
                        showToast('Value copied to clipboard', 'success');
                    })
                    .catch(() => {
                        showToast('Failed to copy value', 'error');
                    });
            })
            .catch(() => {
                showToast('Failed to load utilities', 'error');
            });
    };

    // Listen for keys:selected events from plugins
    useEffect(() => {
        unsubscribeRef.current = on('keys:selected', (event) => {
            const payload = event.payload as {
                keys?: string[];
                pattern?: string;
                action?: string;
            };

            if (payload.keys && payload.keys.length > 0) {
                // Handle individual key selection
                const key = payload.keys[0];
                if (key) {
                    keyDetails.setSelectedKey(key);
                    // Only update search if this is an external search request
                    // (not from internal key selection in the list)
                    if (
                        payload.action === 'search' ||
                        event.source !== 'keys-manager'
                    ) {
                        keysSearch.setInputValue(key);
                        keysSearch.setSearchPattern(key);
                        // Trigger search to show this specific key
                        keysSearch.triggerSearch();
                    }
                }
            } else if (payload.pattern) {
                // Handle pattern search
                const pattern = payload.pattern;
                keysSearch.setInputValue(pattern);
                keysSearch.setSearchPattern(pattern);
                // Add pattern to search history
                keysSearch.addPatternToHistory(pattern);
                // Trigger search with the pattern
                keysSearch.triggerSearch();
            }
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, []);

    const showToast = (message: string, type: 'success' | 'error') => {
        emit({
            type: 'toast:show',
            payload: { message, type },
            source: 'keys-manager'
        });
    };

    // Form save handler
    const handleSaveKey = () => {
        void addKeyForm.handleSaveKey(context, emit);
    };

    return (
        <Container className="keys-manager-plugin">
            {/* Search Keys Section */}
            <KeysSearchSection
                inputValue={keysSearch.inputValue}
                onInputChange={keysSearch.setInputValue}
                onSearch={keysSearch.handleSearch}
                onShowAll={keysSearch.handleShowAll}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        keysSearch.handleSearch();
                    }
                }}
                currentEnvironment={currentEnvironment || undefined}
                searchHistory={keysSearch.searchHistory}
                onHistorySelect={keysSearch.handleHistorySelect}
            />

            {/* Keys List and Details Row */}
            <KeysRow className="keys-row">
                <KeysList
                    keys={keysSearch.keys}
                    selectedKey={keyDetails.selectedKey}
                    isLoadingKeys={keysSearch.isLoadingKeys}
                    hasMore={keysSearch.hasMore}
                    onKeySelect={keyDetails.handleKeySelect}
                    onLoadMore={keysSearch.handleLoadMore}
                />

                <KeyDetails
                    selectedKey={keyDetails.selectedKey}
                    keyDetails={keyDetails.keyDetails}
                    isLoadingDetails={keyDetails.isLoadingDetails}
                    onViewValue={handleViewValue}
                    onCopyValue={handleCopyValue}
                    onRefreshKey={keyDetails.refreshKey}
                    onSetTTL={() => modals.setShowTTLModal(true)}
                    onDelete={keyOperations.handleDelete}
                    onRename={() => modals.setShowRenameModal(true)}
                    onCopy={() => modals.setShowCopyModal(true)}
                />
            </KeysRow>

            {/* Add/Update Key Section */}
            <AddKeyForm
                isExpanded={addKeyForm.isAddFormExpanded}
                onToggleExpanded={() =>
                    addKeyForm.setIsAddFormExpanded(
                        !addKeyForm.isAddFormExpanded
                    )
                }
                keyName={addKeyForm.keyName}
                onKeyNameChange={addKeyForm.setKeyName}
                keyType={addKeyForm.keyType}
                onKeyTypeChange={addKeyForm.setKeyType}
                stringValue={addKeyForm.stringValue}
                onStringValueChange={addKeyForm.setStringValue}
                zsetMembers={addKeyForm.zsetMembers}
                zsetRawValue={addKeyForm.zsetRawValue}
                onAddZsetMember={addKeyForm.handleAddZsetMember}
                onRemoveZsetMember={addKeyForm.handleRemoveZsetMember}
                onUpdateZsetMember={addKeyForm.updateZsetMember}
                onZsetRawValueChange={addKeyForm.setZsetRawValue}
                onParseZsetRawValue={() =>
                    void addKeyForm.handleParseZsetRawValue(emit)
                }
                expiry={addKeyForm.expiry}
                onExpiryChange={addKeyForm.setExpiry}
                onSave={handleSaveKey}
                onClear={addKeyForm.clearForm}
            />

            {/* Modals */}
            <TTLModal
                isOpen={modals.showTTLModal}
                onClose={() => modals.setShowTTLModal(false)}
                selectedKey={keyDetails.selectedKey}
                ttlValue={modals.ttlValue}
                onTtlValueChange={modals.setTtlValue}
                onApply={() => keyOperations.handleSetTTL(modals.ttlValue)}
            />

            <RenameModal
                isOpen={modals.showRenameModal}
                onClose={() => modals.setShowRenameModal(false)}
                selectedKey={keyDetails.selectedKey}
                newKeyName={modals.newKeyName}
                onNewKeyNameChange={modals.setNewKeyName}
                onApply={() => keyOperations.handleRename(modals.newKeyName)}
            />

            <CopyModal
                isOpen={modals.showCopyModal}
                onClose={() => modals.setShowCopyModal(false)}
                selectedKey={keyDetails.selectedKey}
                targetKeyName={modals.targetKeyName}
                onTargetKeyNameChange={modals.setTargetKeyName}
                targetEnv={modals.targetEnv}
                onTargetEnvChange={modals.setTargetEnv}
                connections={connections}
                onApply={() =>
                    keyOperations.handleCopy(
                        modals.targetKeyName,
                        modals.targetEnv
                    )
                }
            />

            <ValueViewerModal
                isOpen={modals.showValueModal}
                onClose={() => modals.setShowValueModal(false)}
                valueModalData={modals.valueModalData}
                onTabChange={modals.handleTabChange}
            />
        </Container>
    );
};

export default KeysManagerPlugin;
