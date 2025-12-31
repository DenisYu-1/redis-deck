import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
    getKeyDetails,
    deleteKey,
    setTTL,
    renameKey,
    copyKey
} from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { KeyDetails as KeyDetailsType } from '@/types';

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

interface KeyDetailsProps {
    onOperationComplete: () => void;
}

export function KeyDetails({ onOperationComplete }: KeyDetailsProps) {
    const { selectedKey, currentEnvironment, setKeyDetails, connections } =
        useAppStore();
    const [details, setDetails] = useState<KeyDetailsType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
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
    const [targetEnv, setTargetEnv] = useState(currentEnvironment ?? '');
    const { showToast } = useToast();

    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedKey || !currentEnvironment) {
                setDetails(null);
                return;
            }

            setIsLoading(true);
            try {
                const keyDetails = await getKeyDetails(
                    selectedKey,
                    currentEnvironment
                );
                setDetails(keyDetails);
                setKeyDetails(keyDetails);
            } catch (error) {
                showToast('Error loading key details', 'error');
                console.error('Error loading key details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void loadDetails();
    }, [selectedKey, currentEnvironment, setKeyDetails, showToast]);

    const handleDelete = async () => {
        if (!selectedKey || !currentEnvironment) return;

        if (!confirm(`Are you sure you want to delete key "${selectedKey}"?`)) {
            return;
        }

        try {
            await deleteKey(selectedKey, currentEnvironment);
            showToast('Key deleted successfully', 'success');
            setDetails(null);
            onOperationComplete();
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
            onOperationComplete();
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
            onOperationComplete();
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
            onOperationComplete();
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
                const lines = value.split('\n').filter((line) => line.trim() !== '');
                if (lines.length === 0) {
                    return 'Empty sorted set';
                }

                let formatted = '';
                for (let i = 0; i < lines.length; i += 2) {
                    if (lines[i]?.trim() && i + 1 < lines.length && lines[i + 1]) {
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

    if (!selectedKey) {
        return (
            <div className="key-details">
                <h3>Key Details</h3>
                <div id="key-info">
                    <p>Select a key to view details</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="key-details">
                <h3>Key Details</h3>
                <div id="key-info">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="key-details">
                <h3>Key Details</h3>
                <div id="key-info">
                    {details && (
                        <>
                            <p>
                                <strong>Key:</strong> {details.key}
                            </p>
                            <p>
                                <strong>Type:</strong> {details.type}
                            </p>
                            <p>
                                <strong>Value:</strong>
                                <div className="value-actions">
                                    <button
                                        className="value-action-btn"
                                        onClick={() =>
                                            handleViewValue(
                                                details.value,
                                                details.type
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
                                            handleCopyValue(details.value)
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
                            <pre>{formatValue(details.type, details.value)}</pre>
                        </>
                    )}
                </div>
                <div id="key-actions">
                    <div className="ttl-info">
                        <span>
                            TTL:{' '}
                            <span id="key-ttl">{details?.ttl ?? 'N/A'}</span>
                        </span>
                        <button
                            onClick={() => setShowTTLModal(true)}
                            className="secondary-btn"
                        >
                            Set TTL
                        </button>
                    </div>
                    <div className="action-buttons">
                        <button onClick={handleDelete} className="danger-btn">
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
            </div>

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
                <div
                    className="modal"
                    onClick={() => setShowValueModal(false)}
                >
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
                                style={{ display: valueModalData.hasJson ? 'inline-block' : 'none' }}
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
                                style={{ display: valueModalData.activeTab === 'tree' ? 'block' : 'none' }}
                                ref={(el: any) => {
                                    if (el && valueModalData.jsonData && valueModalData.activeTab === 'tree') {
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
        </>
    );
}
