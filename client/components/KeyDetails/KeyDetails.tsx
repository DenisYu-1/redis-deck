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
                            </p>
                            <pre>{JSON.stringify(details.value, null, 2)}</pre>
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
        </>
    );
}
