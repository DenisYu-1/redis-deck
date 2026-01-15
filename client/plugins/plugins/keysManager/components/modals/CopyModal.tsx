import React from 'react';

interface CopyModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedKey: string | null;
    targetKeyName: string;
    onTargetKeyNameChange: (name: string) => void;
    targetEnv: string;
    onTargetEnvChange: (env: string) => void;
    connections: any[];
    onApply: () => void;
}

export const CopyModal: React.FC<CopyModalProps> = ({
    isOpen,
    onClose,
    selectedKey,
    targetKeyName,
    onTargetKeyNameChange,
    targetEnv,
    onTargetEnvChange,
    connections,
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
                            onTargetKeyNameChange(e.target.value)
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
                        onChange={(e) => onTargetEnvChange(e.target.value)}
                    >
                        {connections.map((conn) => (
                            <option key={conn.id} value={conn.id}>
                                {conn.id}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="modal-buttons">
                    <button onClick={onApply}>Copy</button>
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