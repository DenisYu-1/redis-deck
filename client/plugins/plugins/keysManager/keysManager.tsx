import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { searchKeys } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { PluginComponentProps } from '../../types';
import {
    getKeyDetails,
    deleteKey,
    setTTL,
    renameKey,
    copyKey
} from '@/services/apiService';

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

interface ZSetMember {
    score: number;
    value: string;
}

type KeyType = 'string' | 'zset' | 'hash' | 'list' | 'set';

interface KeyDetails {
    key: string;
    type: string;
    value: any;
    ttl: number | null;
}

const KeysManagerPlugin: React.FC<PluginComponentProps> = ({
    context,
    emit,
    on
}) => {
    const [searchPattern, setSearchPattern] = useState('*');
    const [inputValue, setInputValue] = useState('*');
    const [searchTrigger, setSearchTrigger] = useState(0);
    const [keys, setKeys] = useState<string[]>([]);
    const [cursors, setCursors] = useState<string[]>(['0']);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [keyDetails, setKeyDetails] = useState<KeyDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [showTTLModal, setShowTTLModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [showValueModal, setShowValueModal] = useState(false);
    const [valueModalData, setValueModalData] = useState<{
        formatted: string;
        jsonData: any;
        hasJson: boolean;
        activeTab: string;
    } | null>(null);
    const [ttlValue, setTtlValue] = useState('');
    const [newKeyName, setNewKeyName] = useState('');
    const [targetKeyName, setTargetKeyName] = useState('');
    const [targetEnv, setTargetEnv] = useState('');

    // Add/Update Key form state
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
    const [keyName, setKeyName] = useState('');
    const [keyType, setKeyType] = useState<KeyType>('string');
    const [stringValue, setStringValue] = useState('');
    const [zsetMembers, setZsetMembers] = useState<ZSetMember[]>([
        { score: 0, value: '' }
    ]);
    const [expiry, setExpiry] = useState('');

    const { currentEnvironment, connections } = useAppStore();
    const { showToast } = useToast();
    const abortControllerRef = useRef<AbortController | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync target environment with current environment
    useEffect(() => {
        setTargetEnv(currentEnvironment ?? '');
    }, [currentEnvironment]);

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
                    setSelectedKey(searchPattern); // Auto-select the found key
                } else if (hasWildcards || searchPattern.trim() === '') {
                    // This is a pattern search - use SCAN
                    const currentCursors = resetList ? ['0'] : cursors;
                    const result = await searchKeys(
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
                    setSelectedKey(null);
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
    }, [currentEnvironment, searchTrigger]);

    // Cleanup effect to cancel any ongoing requests when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Listen for keys:selected events from plugins
    useEffect(() => {
        if (!on) return;

        const unsubscribe = on('keys:selected', (event) => {
            const payload = event.payload as {
                keys?: string[];
                pattern?: string;
            };

            if (payload.keys && payload.keys.length > 0) {
                // Handle individual key selection
                const key = payload.keys[0];
                if (key) {
                    setSelectedKey(key);
                    setInputValue(key);
                    setSearchPattern(key);
                    // Trigger search to show this specific key
                    setSearchTrigger((prev) => prev + 1);
                }
            } else if (payload.pattern) {
                // Handle pattern search
                const pattern = payload.pattern;
                setInputValue(pattern);
                setSearchPattern(pattern);
                // Trigger search with the pattern
                setSearchTrigger((prev) => prev + 1);
            }
        });

        return unsubscribe;
    }, [on]);

    // Load key details when selected key changes
    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedKey || !currentEnvironment) {
                setKeyDetails(null);
                return;
            }

            setIsLoadingDetails(true);
            try {
                const details = await getKeyDetails(
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
                setSelectedKey(currentValue); // Auto-select the found key
            } catch (error) {
                // Key doesn't exist
                setKeys([]);
                setCursors(['0']);
                setHasMore(false);
                setSelectedKey(null);
                showToast('Key not found', 'warning');
            } finally {
                setIsLoadingKeys(false);
            }
        } else {
            // This is a pattern search - trigger the useEffect to load keys
            setSearchTrigger((prev) => prev + 1);
        }
    };

    const handleShowAll = () => {
        setInputValue('*');
        setSearchPattern('*');
        setSearchTrigger((prev) => prev + 1);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    const handleLoadMore = () => {
        void loadKeys(false);
    };

    const handleKeySelect = (key: string) => {
        setSelectedKey(key);
        // Emit event so other plugins know a key was selected
        emit({
            type: 'keys:selected',
            payload: { keys: [key] },
            source: 'keys-manager'
        });
    };

    const handleOperationComplete = () => {
        // Refresh keys list and key details
        setSearchTrigger((prev) => prev + 1);
        if (selectedKey) {
            // Reload details for the selected key
            const loadDetails = async () => {
                try {
                    const details = await getKeyDetails(
                        selectedKey,
                        currentEnvironment!
                    );
                    setKeyDetails(details);
                } catch (error) {
                    console.error('Error reloading key details:', error);
                }
            };
            void loadDetails();
        }
        // Emit operation complete event
        emit({
            type: 'operation:completed',
            source: 'keys-manager'
        });
    };

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

    const handleSetTTL = async () => {
        if (!selectedKey || !currentEnvironment) return;

        const seconds = parseInt(ttlValue, 10);
        if (isNaN(seconds)) {
            showToast('Invalid TTL value', 'error');
            return;
        }

        try {
            await setTTL(selectedKey, seconds, currentEnvironment);
            showToast('TTL set successfully', 'success');
            setShowTTLModal(false);
            setTtlValue('');
            handleOperationComplete();
        } catch (error) {
            showToast('Error setting TTL', 'error');
            console.error('Error setting TTL:', error);
        }
    };

    const handleRename = async () => {
        if (!selectedKey || !currentEnvironment || !newKeyName) return;

        try {
            await renameKey(selectedKey, newKeyName, currentEnvironment);
            showToast('Key renamed successfully', 'success');
            setShowRenameModal(false);
            setNewKeyName('');
            setSelectedKey(newKeyName); // Update selected key to the new name
            handleOperationComplete();
        } catch (error) {
            showToast('Error renaming key', 'error');
            console.error('Error renaming key:', error);
        }
    };

    const handleCopy = async () => {
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
            setShowCopyModal(false);
            setTargetKeyName('');
            handleOperationComplete();
        } catch (error) {
            showToast('Error copying key', 'error');
            console.error('Error copying key:', error);
        }
    };

    const handleViewValue = (value: any, type: string) => {
        try {
            let formatted = '';
            let jsonData = null;
            let hasJson = false;

            if (type === 'zset' && typeof value === 'string') {
                const result = parseZsetForViewer(value);
                formatted = result.formatted;

                if (result.hasJson) {
                    jsonData = result.jsonMap;
                    hasJson = true;
                }
            } else if (typeof value === 'string') {
                try {
                    jsonData = JSON.parse(value);
                    hasJson = true;
                    formatted = JSON.stringify(jsonData, null, 2);
                } catch {
                    formatted = value;
                }
            } else if (
                Array.isArray(value) ||
                (typeof value === 'object' && value !== null)
            ) {
                jsonData = value;
                hasJson = true;
                formatted = JSON.stringify(value, null, 2);
            } else {
                formatted = String(value);
            }

            setValueModalData({
                formatted,
                jsonData,
                hasJson,
                activeTab: hasJson ? 'tree' : 'formatted'
            });
            setShowValueModal(true);
        } catch (error) {
            showToast('Failed to display value', 'error');
            console.error('Error displaying value:', error);
        }
    };

    const handleCopyValue = async (value: any) => {
        try {
            let textToCopy = '';

            if (typeof value === 'string') {
                textToCopy = value;
            } else if (Array.isArray(value)) {
                textToCopy = JSON.stringify(value, null, 2);
            } else if (typeof value === 'object' && value !== null) {
                textToCopy = JSON.stringify(value, null, 2);
            } else {
                textToCopy = String(value);
            }

            await navigator.clipboard.writeText(textToCopy);
            showToast('Value copied to clipboard', 'success');
        } catch (error) {
            showToast('Failed to copy value', 'error');
            console.error('Error copying value:', error);
        }
    };

    const formatValue = (type: string, value: any): string => {
        if (type === 'hash') {
            // Format hash values as key-value pairs
            if (typeof value === 'object' && value !== null) {
                // Already processed into object format
                return Object.entries(value)
                    .map(([key, val]) => `${key}: ${val}`)
                    .join('\n');
            } else if (typeof value === 'string') {
                // Raw string format
                const lines = value.split('\n');
                let formatted = '';
                for (let i = 0; i < lines.length; i += 2) {
                    if (lines[i]?.trim() && i + 1 < lines.length) {
                        formatted += `${lines[i]}: ${lines[i + 1]}\n`;
                    }
                }
                return formatted;
            }
            return String(value);
        } else if (type === 'list' || type === 'set') {
            // Format list or set as numbered items
            if (typeof value === 'string') {
                const items = value.split('\n').filter((item) => item.trim());
                return items
                    .map((item, index) => `${index + 1}) ${item}`)
                    .join('\n');
            } else if (Array.isArray(value)) {
                return value
                    .map((item, index) => `${index + 1}) ${item}`)
                    .join('\n');
            }
            return String(value);
        } else if (type === 'zset') {
            // Format sorted set with scores in a more readable way
            if (typeof value === 'string') {
                const lines = value
                    .split('\n')
                    .filter((line) => line.trim() !== '');
                if (lines.length === 0) {
                    return 'Empty sorted set';
                }

                let formatted = '';
                for (let i = 0; i < lines.length; i += 2) {
                    if (
                        lines[i]?.trim() &&
                        i + 1 < lines.length &&
                        lines[i + 1]
                    ) {
                        const member = lines[i]!.trim();
                        const score = lines[i + 1]!.trim();
                        formatted += `• ${member} → ${score}\n`;
                    }
                }
                return formatted || 'Empty sorted set';
            }
            return String(value);
        }

        // Default for string and other types
        return String(value);
    };

    const parseZsetForViewer = (value: string) => {
        const lines = value.split('\n').filter((line) => line.trim());
        const formattedLines: string[] = [];
        const jsonMap: Record<string, any> = {};
        let hasJson = false;

        for (let i = 0; i < lines.length; i += 2) {
            if (i + 1 < lines.length) {
                const member = lines[i]!.trim();
                const score = lines[i + 1]!.trim();

                try {
                    const parsed = JSON.parse(member);
                    formattedLines.push(
                        `• ${JSON.stringify(parsed, null, 2)} → ${score}`
                    );
                    jsonMap[score] = parsed;
                    hasJson = true;
                } catch {
                    formattedLines.push(`• ${member} → ${score}`);
                }
            }
        }

        return {
            formatted: formattedLines.join('\n\n'),
            jsonMap,
            hasJson
        };
    };

    const handleTabChange = (tab: string) => {
        if (!valueModalData) return;
        setValueModalData((prev) =>
            prev ? { ...prev, activeTab: tab } : null
        );
    };

    // Add/Update Key handlers
    const handleKeyTypeChange = (newType: KeyType) => {
        setKeyType(newType);
    };

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

    const handleSaveKey = async () => {
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
            handleOperationComplete();
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
        setExpiry('');
    };

    return (
        <div
            className="keys-manager-plugin"
            style={{
                backgroundColor: '#ffffff',
                padding: '20px',
                borderRadius: '8px'
            }}
        >
            {/* Search Keys Section */}
            <div
                className="search-section"
                data-priority="0"
                style={{ marginBottom: '20px' }}
            >
                <h2>Search Keys</h2>
                <div className="search-bar">
                    <input
                        ref={searchInputRef}
                        type="text"
                        id="search-pattern"
                        placeholder="Key pattern (e.g., user:*, *name*)"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={!currentEnvironment}
                    >
                        Search
                    </button>
                    <button onClick={handleShowAll} className="secondary-btn">
                        Show All Keys
                    </button>
                </div>
            </div>

            {/* Keys List and Details Row */}
            <div className="keys-row" style={{ display: 'flex', gap: '20px' }}>
                {/* Keys List */}
                <div className="keys-list" style={{ flex: '1' }}>
                    <h3>
                        Keys <span id="keys-count">({keys.length})</span>
                        {isLoadingKeys && <span> (Searching...)</span>}
                    </h3>
                    <ul
                        id="keys-results"
                        style={{
                            opacity: isLoadingKeys ? 0.5 : 1,
                            pointerEvents: isLoadingKeys ? 'none' : 'auto'
                        }}
                    >
                        {keys.map((key) => (
                            <li
                                key={key}
                                className={
                                    selectedKey === key ? 'selected' : ''
                                }
                                onClick={() => handleKeySelect(key)}
                            >
                                {key}
                            </li>
                        ))}
                        {isLoadingKeys && keys.length === 0 && (
                            <li
                                style={{
                                    textAlign: 'center',
                                    padding: '20px',
                                    color: '#666'
                                }}
                            >
                                Searching for keys...
                            </li>
                        )}
                    </ul>
                    <div className="pagination-controls">
                        <div className="pagination-status">
                            <span id="pagination-info">
                                Showing {keys.length} keys
                            </span>
                        </div>
                        <button
                            id="load-more-btn"
                            className="secondary-btn"
                            disabled={!hasMore || isLoadingKeys}
                            onClick={handleLoadMore}
                        >
                            {isLoadingKeys ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                </div>

                {/* Key Details */}
                <div className="key-details" style={{ flex: '1' }}>
                    <h3>Key Details</h3>
                    <div id="key-info">
                        {selectedKey ? (
                            keyDetails ? (
                                <>
                                    <p>
                                        <strong>Key:</strong> {keyDetails.key}
                                    </p>
                                    <p>
                                        <strong>Type:</strong> {keyDetails.type}
                                    </p>
                                    <p>
                                        <strong>Value:</strong>
                                        <div className="value-actions">
                                            <button
                                                className="value-action-btn"
                                                onClick={() =>
                                                    handleViewValue(
                                                        keyDetails.value,
                                                        keyDetails.type
                                                    )
                                                }
                                                title="View formatted value"
                                            >
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="3"
                                                    ></circle>
                                                </svg>
                                            </button>
                                            <button
                                                className="value-action-btn"
                                                onClick={() =>
                                                    handleCopyValue(
                                                        keyDetails.value
                                                    )
                                                }
                                                title="Copy value"
                                            >
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <rect
                                                        x="9"
                                                        y="9"
                                                        width="13"
                                                        height="13"
                                                        rx="2"
                                                        ry="2"
                                                    ></rect>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </p>
                                    <pre>
                                        {formatValue(
                                            keyDetails.type,
                                            keyDetails.value
                                        )}
                                    </pre>
                                </>
                            ) : isLoadingDetails ? (
                                <p>Loading...</p>
                            ) : (
                                <p>Error loading key details</p>
                            )
                        ) : (
                            <p>Select a key to view details</p>
                        )}
                    </div>
                    {selectedKey && keyDetails && (
                        <div id="key-actions">
                            <div className="ttl-info">
                                <span>
                                    TTL:{' '}
                                    <span id="key-ttl">
                                        {keyDetails.ttl ?? 'N/A'}
                                    </span>
                                </span>
                                <button
                                    onClick={() => setShowTTLModal(true)}
                                    className="secondary-btn"
                                >
                                    Set TTL
                                </button>
                            </div>
                            <div className="action-buttons">
                                <button
                                    onClick={handleDelete}
                                    className="danger-btn"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setShowRenameModal(true)}
                                    className="secondary-btn"
                                >
                                    Rename
                                </button>
                                <button
                                    onClick={() => setShowCopyModal(true)}
                                    className="secondary-btn"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Update Key Section */}
            <section
                className="add-key-section"
                style={{
                    marginTop: '20px',
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        marginBottom: isAddFormExpanded ? '1rem' : '0'
                    }}
                    onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
                >
                    <h2 style={{ margin: '0', fontSize: '18px' }}>
                        Add/Update Key
                    </h2>
                    <span
                        style={{
                            transform: isAddFormExpanded
                                ? 'rotate(180deg)'
                                : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            fontSize: '12px'
                        }}
                    >
                        ▼
                    </span>
                </div>

                {isAddFormExpanded && (
                    <div>
                        <div
                            className="form-group"
                            style={{ marginBottom: '1rem' }}
                        >
                            <label
                                htmlFor="new-key"
                                style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                Key:
                            </label>
                            <input
                                type="text"
                                id="new-key"
                                value={keyName}
                                onChange={(e) => setKeyName(e.target.value)}
                                placeholder="Enter key name"
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div
                            className="form-group"
                            style={{ marginBottom: '1rem' }}
                        >
                            <label
                                htmlFor="key-type"
                                style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                Type:
                            </label>
                            <select
                                id="key-type"
                                value={keyType}
                                onChange={(e) =>
                                    handleKeyTypeChange(
                                        e.target.value as KeyType
                                    )
                                }
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="string">String</option>
                                <option value="zset">Sorted Set (ZSet)</option>
                                <option value="hash">Hash</option>
                                <option value="list">List</option>
                                <option value="set">Set</option>
                            </select>
                        </div>

                        {/* String type fields */}
                        {keyType === 'string' && (
                            <div
                                id="string-fields"
                                className="type-fields"
                                style={{ marginBottom: '1rem' }}
                            >
                                <div className="form-group">
                                    <label
                                        htmlFor="new-value"
                                        style={{
                                            display: 'block',
                                            marginBottom: '0.5rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Value:
                                    </label>
                                    <textarea
                                        id="new-value"
                                        value={stringValue}
                                        onChange={(e) =>
                                            setStringValue(e.target.value)
                                        }
                                        placeholder="Enter value"
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            minHeight: '80px',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ZSet type fields */}
                        {keyType === 'zset' && (
                            <div
                                id="zset-fields"
                                className="type-fields"
                                style={{ marginBottom: '1rem' }}
                            >
                                <div className="form-group">
                                    <label
                                        style={{
                                            display: 'block',
                                            marginBottom: '0.5rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Members (Score-Value pairs):
                                    </label>
                                    <div
                                        id="zset-members"
                                        style={{ marginBottom: '1rem' }}
                                    >
                                        {zsetMembers.map((member, index) => (
                                            <div
                                                key={index}
                                                className="zset-member"
                                                style={{
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    alignItems: 'center',
                                                    marginBottom: '0.5rem'
                                                }}
                                            >
                                                <input
                                                    type="number"
                                                    className="zset-score"
                                                    value={member.score}
                                                    onChange={(e) =>
                                                        updateZsetMember(
                                                            index,
                                                            'score',
                                                            parseFloat(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                    placeholder="Score"
                                                    step="any"
                                                    style={{
                                                        flex: '1',
                                                        padding: '0.5rem',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    className="zset-value"
                                                    value={member.value}
                                                    onChange={(e) =>
                                                        updateZsetMember(
                                                            index,
                                                            'value',
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="Value"
                                                    style={{
                                                        flex: '2',
                                                        padding: '0.5rem',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className="remove-member-btn"
                                                    onClick={() =>
                                                        handleRemoveZsetMember(
                                                            index
                                                        )
                                                    }
                                                    disabled={
                                                        zsetMembers.length <= 1
                                                    }
                                                    style={{
                                                        padding: '0.5rem',
                                                        backgroundColor:
                                                            zsetMembers.length <=
                                                            1
                                                                ? '#ccc'
                                                                : '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor:
                                                            zsetMembers.length <=
                                                            1
                                                                ? 'not-allowed'
                                                                : 'pointer',
                                                        fontSize: '14px',
                                                        width: '40px'
                                                    }}
                                                    title="Remove member"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        id="add-zset-member-btn"
                                        onClick={handleAddZsetMember}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Add Member
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Common fields */}
                        <div
                            className="form-group"
                            style={{ marginBottom: '1rem' }}
                        >
                            <label
                                htmlFor="expiry"
                                style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                Expiry (seconds, optional):
                            </label>
                            <input
                                type="number"
                                id="expiry"
                                value={expiry}
                                onChange={(e) => setExpiry(e.target.value)}
                                placeholder="Leave empty for no expiry"
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                id="add-key-btn"
                                onClick={handleSaveKey}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Save Key
                            </button>
                            <button
                                type="button"
                                onClick={clearForm}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Modals */}
            {showTTLModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span
                            className="close-modal"
                            onClick={() => setShowTTLModal(false)}
                        >
                            &times;
                        </span>
                        <h3>Set Time To Live</h3>
                        <p>
                            Current key: <span>{selectedKey}</span>
                        </p>
                        <div className="form-group">
                            <label htmlFor="ttl-seconds">TTL (seconds):</label>
                            <input
                                type="number"
                                id="ttl-seconds"
                                placeholder="Enter seconds"
                                value={ttlValue}
                                onChange={(e) => setTtlValue(e.target.value)}
                            />
                            <p className="help-text">Use -1 to remove expiry</p>
                        </div>
                        <div className="modal-buttons">
                            <button onClick={handleSetTTL}>Apply</button>
                            <button
                                onClick={() => setShowTTLModal(false)}
                                className="secondary-btn"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRenameModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span
                            className="close-modal"
                            onClick={() => setShowRenameModal(false)}
                        >
                            &times;
                        </span>
                        <h3>Rename Key</h3>
                        <p>
                            Current key: <span>{selectedKey}</span>
                        </p>
                        <div className="form-group">
                            <label htmlFor="rename-new-key">
                                New key name:
                            </label>
                            <input
                                type="text"
                                id="rename-new-key"
                                placeholder="Enter new key name"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                            />
                        </div>
                        <div className="modal-buttons">
                            <button onClick={handleRename}>Apply</button>
                            <button
                                onClick={() => setShowRenameModal(false)}
                                className="secondary-btn"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCopyModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span
                            className="close-modal"
                            onClick={() => setShowCopyModal(false)}
                        >
                            &times;
                        </span>
                        <h3>Copy Key</h3>
                        <p>
                            Source key: <span>{selectedKey}</span>
                        </p>
                        <div className="form-group">
                            <label htmlFor="copy-target-key">
                                Target key name:
                            </label>
                            <input
                                type="text"
                                id="copy-target-key"
                                placeholder="Enter target key name"
                                value={targetKeyName}
                                onChange={(e) =>
                                    setTargetKeyName(e.target.value)
                                }
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="copy-target-env">
                                Target environment:
                            </label>
                            <select
                                id="copy-target-env"
                                value={targetEnv}
                                onChange={(e) => setTargetEnv(e.target.value)}
                            >
                                {connections.map((conn) => (
                                    <option key={conn.id} value={conn.id}>
                                        {conn.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-buttons">
                            <button onClick={handleCopy}>Copy</button>
                            <button
                                onClick={() => setShowCopyModal(false)}
                                className="secondary-btn"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showValueModal && valueModalData && (
                <div className="modal" onClick={() => setShowValueModal(false)}>
                    <div
                        className="modal-content value-viewer-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span
                            className="close-modal"
                            onClick={() => setShowValueModal(false)}
                        >
                            &times;
                        </span>
                        <h3>View Value</h3>

                        <div className="value-tabs">
                            <button
                                className={`value-tab-btn ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                                onClick={() => handleTabChange('formatted')}
                                data-tab="formatted"
                            >
                                Formatted
                            </button>
                            <button
                                className={`value-tab-btn ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                                onClick={() => handleTabChange('tree')}
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

                        <div className="value-viewer-container">
                            <pre
                                className={`value-viewer-raw value-tab-content ${valueModalData.activeTab === 'formatted' ? 'active' : ''}`}
                                data-content="formatted"
                            >
                                {valueModalData.formatted}
                            </pre>
                            <json-viewer
                                className={`value-tab-content ${valueModalData.activeTab === 'tree' ? 'active' : ''}`}
                                data-content="tree"
                                style={{
                                    display:
                                        valueModalData.activeTab === 'tree'
                                            ? 'block'
                                            : 'none'
                                }}
                                ref={(el: any) => {
                                    if (
                                        el &&
                                        valueModalData.jsonData &&
                                        valueModalData.activeTab === 'tree'
                                    ) {
                                        el.data = valueModalData.jsonData;
                                        // Expand all nodes after a short delay
                                        setTimeout(() => {
                                            if (el.expandAll) {
                                                el.expandAll();
                                            }
                                        }, 100);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KeysManagerPlugin;
