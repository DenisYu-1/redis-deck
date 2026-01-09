import React from 'react';

interface RenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedKey: string | null;
    newKeyName: string;
    onNewKeyNameChange: (name: string) => void;
    onApply: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
    isOpen,
    onClose,
    selectedKey,
    newKeyName,
    onNewKeyNameChange,
    onApply,
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content">
                <span
                    className="close-modal"
                    onClick={onClose}
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
                        onChange={(e) => onNewKeyNameChange(e.target.value)}
                    />
                </div>
                <div className="modal-buttons">
                    <button onClick={onApply}>Apply</button>
                    <button
                        onClick={onClose}
                        className="secondary-btn"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};