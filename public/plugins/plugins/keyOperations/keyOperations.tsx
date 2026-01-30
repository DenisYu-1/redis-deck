import React, { useState, useEffect } from 'react';
import type { PluginComponentProps } from '../../../client/plugins/types';

interface KeyOperation {
    id: string;
    name: string;
    description: string;
    action: () => void | Promise<void>;
}

const KeyOperationsPlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Listen for key selection events
        const unsubscribeKeysSelected = on('keys:selected', (event) => {
            const keys = event.payload?.keys as string[] || [];
            setSelectedKeys(keys);
        });

        // Listen for operation completion to refresh
        const unsubscribeOperationComplete = on('operation:completed', () => {
            // Could refresh key list or update UI
            console.log('Key operations plugin: operation completed, refreshing...');
        });

        return () => {
            unsubscribeKeysSelected();
            unsubscribeOperationComplete();
        };
    }, [on]);

    const operations: KeyOperation[] = [
        {
            id: 'view',
            name: 'View Details',
            description: 'View key details and value',
            action: () => {
                if (selectedKeys.length === 1) {
                    emit({
                        type: 'keys:selected',
                        payload: { keys: selectedKeys, action: 'view' },
                        source: 'key-operations'
                    });
                }
            }
        },
        {
            id: 'delete',
            name: 'Delete Keys',
            description: `Delete ${selectedKeys.length} selected key${selectedKeys.length !== 1 ? 's' : ''}`,
            action: async () => {
                if (selectedKeys.length === 0) return;

                const confirmMessage = selectedKeys.length === 1
                    ? `Delete key "${selectedKeys[0]}"?`
                    : `Delete ${selectedKeys.length} selected keys?`;

                if (confirm(confirmMessage)) {
                    try {
                        // Emit delete event that other plugins can handle
                        emit({
                            type: 'keys:deleted',
                            payload: {
                                keys: selectedKeys,
                                environment: context.getCurrentEnvironment()
                            },
                            source: 'key-operations'
                        });

                        emit({
                            type: 'toast:show',
                            payload: {
                                message: `Deleted ${selectedKeys.length} key${selectedKeys.length !== 1 ? 's' : ''}`,
                                type: 'success'
                            },
                            source: 'key-operations'
                        });

                        setSelectedKeys([]);
                    } catch (error: any) {
                        emit({
                            type: 'toast:show',
                            payload: { message: error.message, type: 'error' },
                            source: 'key-operations'
                        });
                    }
                }
            }
        },
        {
            id: 'copy-keys',
            name: 'Copy Keys',
            description: 'Copy selected key names to clipboard',
            action: async () => {
                if (selectedKeys.length === 0) return;

                try {
                    await navigator.clipboard.writeText(selectedKeys.join('\n'));
                    emit({
                        type: 'toast:show',
                        payload: {
                            message: `Copied ${selectedKeys.length} key${selectedKeys.length !== 1 ? 's' : ''} to clipboard`,
                            type: 'success'
                        },
                        source: 'key-operations'
                    });
                } catch (error: any) {
                    emit({
                        type: 'toast:show',
                        payload: { message: 'Failed to copy to clipboard', type: 'error' },
                        source: 'key-operations'
                    });
                }
            }
        }
    ];

    const availableOperations = operations.filter(op => {
        if (op.id === 'view') return selectedKeys.length === 1;
        return selectedKeys.length > 0;
    });

    return (
        <div className="key-operations-plugin" style={{
            margin: '1rem 0',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9'
        }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: isExpanded ? '1rem' : '0'
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h4 style={{ margin: '0' }}>
                    Key Operations {selectedKeys.length > 0 && `(${selectedKeys.length} selected)`}
                </h4>
                <span style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: '12px'
                }}>
                    ▼
                </span>
            </div>

            {isExpanded && (
                <div>
                    {availableOperations.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic', margin: '0' }}>
                            Select keys to see available operations
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {availableOperations.map((operation) => (
                                <button
                                    key={operation.id}
                                    onClick={() => operation.action()}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        textAlign: 'left',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.backgroundColor = '#0056b3';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.backgroundColor = '#007bff';
                                    }}
                                >
                                    <strong>{operation.name}</strong>
                                    <small style={{ opacity: 0.9, fontWeight: 'normal' }}>
                                        {operation.description}
                                    </small>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedKeys.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #ddd' }}>
                            <small style={{ color: '#666' }}>
                                Selected keys: {selectedKeys.slice(0, 3).join(', ')}
                                {selectedKeys.length > 3 && ` and ${selectedKeys.length - 3} more`}
                            </small>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default KeyOperationsPlugin;
