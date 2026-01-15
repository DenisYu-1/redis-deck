import React, { useState, useEffect } from 'react';
import { deleteKeysByPattern } from '../../../js/services/apiService.js';
import { showToast } from '../../../js/utils/domUtils.js';
import type { PluginComponentProps } from '../../../client/plugins/types';

const BatchDeletePlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    const [pattern, setPattern] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        // Listen for keys deleted events from other plugins
        const unsubscribe = on('keys:deleted', (event) => {
            console.log('Batch delete plugin received keys deleted event:', event);
            // Could update UI or refresh data here
        });

        return unsubscribe;
    }, [on]);

    const handleBatchDelete = async () => {
        if (!pattern.trim()) {
            emit({
                type: 'toast:show',
                payload: { message: 'Pattern is required', type: 'error' },
                source: 'batch-delete'
            });
            return;
        }

        if (!confirm(`Are you sure you want to delete all keys matching the pattern "${pattern}"?`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const environment = context.getCurrentEnvironment();
            const result = await deleteKeysByPattern(pattern, environment);

            emit({
                type: 'keys:deleted',
                payload: {
                    pattern,
                    count: result.deletedCount || 0,
                    environment
                },
                source: 'batch-delete'
            });

            emit({
                type: 'toast:show',
                payload: { message: result.message, type: 'success' },
                source: 'batch-delete'
            });

            setPattern('');

            // Notify that operation is complete
            emit({
                type: 'operation:completed',
                source: 'batch-delete'
            });

        } catch (error: any) {
            emit({
                type: 'toast:show',
                payload: { message: error.message, type: 'error' },
                source: 'batch-delete'
            });
            console.error('Error deleting keys:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isDeleting) {
            handleBatchDelete();
        }
    };

    return (
        <div className="batch-delete-plugin" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Batch Delete Keys</h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    placeholder="Pattern (e.g., user:*, cache:*, *)"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isDeleting}
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}
                />
                <button
                    onClick={handleBatchDelete}
                    disabled={isDeleting || !pattern.trim()}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: isDeleting ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        fontSize: '14px'
                    }}
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                Use patterns like: <code>user:*</code>, <code>cache:*</code>, or <code>*</code> for all keys
            </small>
        </div>
    );
};

export default BatchDeletePlugin;
