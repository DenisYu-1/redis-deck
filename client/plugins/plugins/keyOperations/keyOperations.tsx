import React, { useState } from 'react';
import type { PluginComponentProps } from '../../types';
import { saveKey, addToSortedSet } from '@/services/apiService';

interface ZSetMember {
    score: number;
    value: string;
}

type KeyType = 'string' | 'zset' | 'hash' | 'list' | 'set';

const KeyOperationsPlugin: React.FC<PluginComponentProps> = ({
    context,
    emit
}) => {
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);

    // Form state
    const [keyName, setKeyName] = useState('');
    const [keyType, setKeyType] = useState<KeyType>('string');
    const [stringValue, setStringValue] = useState('');
    const [zsetMembers, setZsetMembers] = useState<ZSetMember[]>([
        { score: 0, value: '' }
    ]);
    const [expiry, setExpiry] = useState('');

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
                source: 'key-operations'
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
                        source: 'key-operations'
                    });
                    return;
                }

                await saveKey(keyName, stringValue, expiryValue, environment);
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
                        source: 'key-operations'
                    });
                    return;
                }

                await addToSortedSet(
                    keyName,
                    validMembers,
                    expiryValue,
                    environment
                );
                setZsetMembers([{ score: 0, value: '' }]);
            } else {
                emit({
                    type: 'toast:show',
                    payload: {
                        message: `Support for ${keyType} keys is not implemented yet`,
                        type: 'error'
                    },
                    source: 'key-operations'
                });
                return;
            }

            emit({
                type: 'toast:show',
                payload: {
                    message: `Key "${keyName}" saved successfully`,
                    type: 'success'
                },
                source: 'key-operations'
            });

            // Reset form
            setKeyName('');
            setExpiry('');
            setKeyType('string');

            // Emit operation complete to refresh key list
            emit({
                type: 'operation:completed',
                source: 'key-operations'
            });
        } catch (error: any) {
            emit({
                type: 'toast:show',
                payload: { message: error.message, type: 'error' },
                source: 'key-operations'
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
        <div className="key-operations-plugin">
            {/* Add/Update Key Section */}
            <section
                className="add-key-section"
                style={{
                    margin: '1rem 0',
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
        </div>
    );
};

export default KeyOperationsPlugin;
