import React, { useState } from 'react';
import type { PluginComponentProps } from '../../../client/plugins/types';

const CustomSearchesPlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const searches = [
        {
            id: 'command-locks-btn',
            text: 'Commands locks',
            pattern: 'command-lock*'
        },
        {
            id: 'tipp-chats-lock-btn',
            text: 'TippChatsLock',
            pattern: 'command-lock_core:tippspiel:cache-conversations'
        },
        {
            id: 'queues-btn',
            text: 'Queues',
            pattern: 'c24-test-community-*'
        },
        {
            id: 'queues-prod-btn',
            text: 'Queues (prod)',
            pattern: 'c24-prod-community-*'
        },
        {
            id: 'sso-activities-btn',
            text: 'Sso Activities(userId)',
            pattern: 'sso_activities:user:*'
        }
    ];

    const handleSearch = (pattern: string) => {
        // Emit search event that can be handled by the main app
        emit({
            type: 'keys:selected',
            payload: { pattern, action: 'search' },
            source: 'custom-searches'
        });

        emit({
            type: 'toast:show',
            payload: {
                message: `Searching for: ${pattern}`,
                type: 'info'
            },
            source: 'custom-searches'
        });
    };

    return (
        <div className="custom-searches-plugin" style={{
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
                <h4 style={{ margin: '0' }}>Custom Searches</h4>
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
                    <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '14px' }}>
                        Quick search buttons for common Redis patterns:
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.5rem'
                    }}>
                        {searches.map((search) => (
                            <button
                                key={search.id}
                                onClick={() => handleSearch(search.pattern)}
                                style={{
                                    padding: '0.5rem',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    textAlign: 'left'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = '#0056b3';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = '#007bff';
                                }}
                            >
                                <strong>{search.text}</strong>
                                <br />
                                <small style={{ opacity: 0.9, fontWeight: 'normal' }}>
                                    {search.pattern}
                                </small>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSearchesPlugin;
