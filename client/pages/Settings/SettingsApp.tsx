import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Toast } from '@/components/common/Toast';
import { setTheme, getTheme } from '@/utils/theme';
import { useToast } from '@/hooks/useToast';
import {
    loadEnvironments,
    addConnection,
    updateConnection,
    deleteConnection,
    testConnection
} from '@/services/apiService';
import type { RedisConnection } from '@/types';

export function SettingsApp() {
    const [connections, setConnections] = useState<RedisConnection[]>([]);
    const [currentTheme, setCurrentTheme] = useState(getTheme());
    const [isEditing, setIsEditing] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<RedisConnection | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const conns = await loadEnvironments();
                setConnections(conns);
            } catch (error) {
                showToast('Error loading connections', 'error');
                console.error('Error loading connections:', error);
            }
        };

        void fetchConnections();
    }, [showToast]);

    const handleThemeChange = (theme: 'light' | 'dark') => {
        setTheme(theme);
        setCurrentTheme(theme);
    };

    const handleAddNew = () => {
        setEditingConnection({
            id: '',
            host: '',
            port: 6379,
            tls: false,
            cluster: false
        });
        setIsEditing(true);
    };

    const handleEdit = (connection: RedisConnection) => {
        setEditingConnection(connection);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Are you sure you want to delete connection "${id}"?`)) {
            return;
        }

        try {
            await deleteConnection(id);
            setConnections((prev) => prev.filter((c) => c.id !== id));
            showToast('Connection deleted successfully', 'success');
        } catch (error) {
            showToast('Error deleting connection', 'error');
            console.error('Error deleting connection:', error);
        }
    };

    const handleSave = async (connection: RedisConnection) => {
        try {
            const isNew = !connections.find((c) => c.id === connection.id);

            if (isNew) {
                await addConnection(connection);
                setConnections((prev) => [...prev, connection]);
                showToast('Connection added successfully', 'success');
            } else {
                await updateConnection(connection);
                setConnections((prev) =>
                    prev.map((c) => (c.id === connection.id ? connection : c))
                );
                showToast('Connection updated successfully', 'success');
            }

            setIsEditing(false);
            setEditingConnection(null);
        } catch (error) {
            showToast('Error saving connection', 'error');
            console.error('Error saving connection:', error);
        }
    };

    const handleTest = async (connection: RedisConnection) => {
        try {
            const result = await testConnection(connection.id);
            if (result) {
                showToast('Connection successful', 'success');
            } else {
                showToast('Connection failed', 'error');
            }
        } catch (error) {
            showToast('Connection test failed', 'error');
            console.error('Connection test failed:', error);
        }
    };

    return (
        <div className="container">
            <Header showNavigation={false}>
                <div className="connection-info">
                    <span
                        id="total-keys-count"
                        className="total-keys"
                        style={{ display: 'none' }}
                    >
                        Total Keys: N/A
                    </span>
                </div>
                <div className="redis-info-button">
                    <a
                        href="/"
                        className="secondary-btn"
                        title="Back to Main UI"
                    >
                        ↩️
                    </a>
                </div>
            </Header>

            <main className="connections-manager">
                <h2>Settings</h2>

                <section className="settings-section">
                    <h3>Appearance</h3>
                    <div className="setting-item">
                        <div className="setting-info">
                            <label>Theme</label>
                            <span className="description">
                                Choose your preferred color theme
                            </span>
                        </div>
                        <div className="setting-control">
                            <div className="theme-selector">
                                <button
                                    className={`theme-option ${currentTheme === 'light' ? 'active' : ''}`}
                                    onClick={() => handleThemeChange('light')}
                                >
                                    ☀️ Light
                                </button>
                                <button
                                    className={`theme-option ${currentTheme === 'dark' ? 'active' : ''}`}
                                    onClick={() => handleThemeChange('dark')}
                                >
                                    🌙 Dark
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <h2>Redis Connections Manager</h2>

                <section
                    className="connections-list"
                    id="connections-container"
                >
                    <h3>Available Connections</h3>
                    <div id="connections-list">
                        {connections.length === 0 ? (
                            <p>No connections configured.</p>
                        ) : (
                            connections.map((conn) => (
                                <div key={conn.id} className="connection-card">
                                    <div className="connection-details">
                                        <strong>{conn.id}</strong>
                                        <div
                                            style={{
                                                fontSize: '0.9em',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {conn.host}:{conn.port}
                                            {conn.tls ? ' (TLS)' : ''}
                                            {conn.cluster ? ' (Cluster)' : ''}
                                        </div>
                                    </div>
                                    <div className="connection-actions">
                                        <button
                                            onClick={() => handleEdit(conn)}
                                            className="secondary-btn"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDelete(conn.id)
                                            }
                                            className="danger-btn"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            marginTop: '15px'
                        }}
                    >
                        <button onClick={handleAddNew}>
                            Add New Connection
                        </button>
                    </div>
                </section>

                {isEditing && editingConnection && (
                    <ConnectionForm
                        connection={editingConnection}
                        onSave={handleSave}
                        onTest={handleTest}
                        onCancel={() => {
                            setIsEditing(false);
                            setEditingConnection(null);
                        }}
                    />
                )}
            </main>

            <Toast />
        </div>
    );
}

interface ConnectionFormProps {
    connection: RedisConnection;
    onSave: (connection: RedisConnection) => void;
    onTest: (connection: RedisConnection) => void;
    onCancel: () => void;
}

function ConnectionForm({
    connection,
    onSave,
    onTest,
    onCancel
}: ConnectionFormProps) {
    const [formData, setFormData] = useState(connection);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <section className="connection-form" id="connection-form-container">
            <div className="edit-mode-header">
                <h3>
                    {connection.id ? 'Edit Connection' : 'Add New Connection'}
                </h3>
            </div>

            <form id="connection-form" onSubmit={handleSubmit}>
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="connection-id">
                            Connection ID (alphanumeric, no spaces):
                        </label>
                        <input
                            type="text"
                            id="connection-id"
                            placeholder="e.g., production, development"
                            required
                            value={formData.id}
                            onChange={(e) =>
                                setFormData({ ...formData, id: e.target.value })
                            }
                            disabled={!!connection.id}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="connection-host">Host:</label>
                        <input
                            type="text"
                            id="connection-host"
                            placeholder="e.g., localhost, redis.example.com"
                            required
                            value={formData.host}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    host: e.target.value
                                })
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="connection-port">Port:</label>
                        <input
                            type="number"
                            id="connection-port"
                            placeholder="e.g., 6379"
                            required
                            value={formData.port}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    port: parseInt(e.target.value, 10)
                                })
                            }
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="connection-username">
                            Username (optional):
                        </label>
                        <input
                            type="text"
                            id="connection-username"
                            placeholder="Redis username"
                            value={formData.username ?? ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFormData({
                                    ...formData,
                                    username: value ? value : undefined
                                } as RedisConnection);
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="connection-password">
                            Password (optional):
                        </label>
                        <input
                            type="password"
                            id="connection-password"
                            placeholder="Redis password"
                            value={formData.password ?? ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFormData({
                                    ...formData,
                                    password: value ? value : undefined
                                } as RedisConnection);
                            }}
                        />
                    </div>
                </div>

                <div className="tls-checkbox">
                    <input
                        type="checkbox"
                        id="connection-tls"
                        checked={formData.tls}
                        onChange={(e) =>
                            setFormData({ ...formData, tls: e.target.checked })
                        }
                    />
                    <label htmlFor="connection-tls">Use TLS/SSL</label>
                </div>
                <div className="tls-checkbox">
                    <input
                        type="checkbox"
                        id="connection-cluster"
                        checked={formData.cluster}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                cluster: e.target.checked
                            })
                        }
                    />
                    <label htmlFor="connection-cluster">
                        Redis Cluster (enable redirects)
                    </label>
                </div>

                <div className="form-actions">
                    <button type="submit">Save Connection</button>
                    <button
                        type="button"
                        onClick={() => onTest(formData)}
                        className="secondary-btn"
                    >
                        Test Connection
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="secondary-btn"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
}
