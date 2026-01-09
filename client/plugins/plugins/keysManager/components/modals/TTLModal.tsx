import React from 'react';

interface TTLModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedKey: string | null;
    ttlValue: string;
    onTtlValueChange: (value: string) => void;
    onApply: () => void;
}

export const TTLModal: React.FC<TTLModalProps> = ({
    isOpen,
    onClose,
    selectedKey,
    ttlValue,
    onTtlValueChange,
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
                        onChange={(e) => onTtlValueChange(e.target.value)}
                    />
                    <p className="help-text">Use -1 to remove expiry</p>
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