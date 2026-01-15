import React, { useState, useEffect } from 'react';
import type { PluginComponentProps } from '../../../client/plugins/types';

const NewsFeedPlugin: React.FC<PluginComponentProps> = ({ context, emit, on }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [newsItems, setNewsItems] = useState<Array<{id: string, title: string, content: string, timestamp: number}>>([]);

    useEffect(() => {
        // Simulate loading news items
        const mockNews = [
            {
                id: '1',
                title: 'Redis 7.0 Released',
                content: 'Redis 7.0 brings major performance improvements and new features.',
                timestamp: Date.now() - 86400000 // 1 day ago
            },
            {
                id: '2',
                title: 'New Plugin System',
                content: 'The new React-based plugin system is now available for enhanced extensibility.',
                timestamp: Date.now() - 3600000 // 1 hour ago
            }
        ];

        setNewsItems(mockNews);

        // Listen for system events that might generate news
        const unsubscribe = on('operation:completed', (event) => {
            if (event.source === 'batch-delete' || event.source === 'key-operations') {
                const newItem = {
                    id: Date.now().toString(),
                    title: 'Operation Completed',
                    content: `${event.source} operation finished successfully`,
                    timestamp: Date.now()
                };
                setNewsItems(prev => [newItem, ...prev.slice(0, 9)]); // Keep last 10 items
            }
        });

        return unsubscribe;
    }, [on]);

    const formatTimestamp = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    return (
        <div className="news-feed-plugin" style={{
            margin: '1rem 0',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa'
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
                <h4 style={{ margin: '0', color: '#495057' }}>
                    News Feed {newsItems.length > 0 && `(${newsItems.length})`}
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
                    {newsItems.length === 0 ? (
                        <p style={{ color: '#666', margin: '0', fontStyle: 'italic' }}>
                            No news items yet. News will appear here as Redis operations are performed.
                        </p>
                    ) : (
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {newsItems.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        backgroundColor: 'white',
                                        borderRadius: '4px',
                                        border: '1px solid #e9ecef',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '0.25rem'
                                    }}>
                                        <h5 style={{
                                            margin: '0',
                                            fontSize: '14px',
                                            color: '#495057'
                                        }}>
                                            {item.title}
                                        </h5>
                                        <small style={{
                                            color: '#6c757d',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {formatTimestamp(item.timestamp)}
                                        </small>
                                    </div>
                                    <p style={{
                                        margin: '0',
                                        fontSize: '13px',
                                        color: '#666',
                                        lineHeight: '1.4'
                                    }}>
                                        {item.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{
                        marginTop: '1rem',
                        padding: '0.5rem',
                        backgroundColor: '#e7f3ff',
                        border: '1px solid #b8daff',
                        borderRadius: '4px'
                    }}>
                        <small style={{ color: '#004085' }}>
                            <strong>Note:</strong> This news feed shows Redis-related updates and operation summaries.
                        </small>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsFeedPlugin;
