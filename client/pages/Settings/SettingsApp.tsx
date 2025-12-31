import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
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

// Styled Components
const ConnectionsManager = styled.main`
    margin-top: 30px;
`;

const SettingsSection = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-bottom: 20px;
`;

const SettingItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const SettingInfo = styled.div`
    flex: 1;
    margin-right: 20px;

    label {
        display: block;
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 5px;
    }

    .description {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0;
    }
`;

const SettingControl = styled.div`
    flex-shrink: 0;
`;

const ThemeSelector = styled.div`
    display: flex;
    gap: 10px;
`;

const ThemeOption = styled.button<{ $active?: boolean }>`
    padding: 10px 16px;
    border: 2px solid var(--border-secondary);
    border-radius: 6px;
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;

    &:hover {
        border-color: var(--accent-primary);
        background-color: var(--bg-hover);
        color: var(--text-primary);
    }

    ${({ $active }) =>
        $active &&
        `
        border-color: var(--accent-primary);
        background-color: var(--bg-active);
        color: var(--accent-primary);
        font-weight: 600;
    `}
`;

const ConnectionsList = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-bottom: 20px;
`;

const ConnectionCard = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    margin-bottom: 10px;
    background-color: var(--bg-tertiary);
    transition: all 0.2s ease;

    &:hover {
        border-color: var(--accent-primary);
        background-color: var(--bg-hover);
    }

    &:last-child {
        margin-bottom: 0;
    }
`;

const ConnectionDetails = styled.div`
    flex: 1;

    strong {
        display: block;
        font-size: 16px;
        color: var(--text-primary);
        margin-bottom: 4px;
    }

    div {
        font-size: 0.9em;
        color: var(--text-secondary);
    }
`;

const ConnectionActions = styled.div`
    display: flex;
    gap: 8px;
`;

const AddConnectionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background-color: var(--button-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 15px;

    &:hover {
        background-color: var(--button-primary-hover);
    }
`;

const StyledConnectionForm = styled.section`
    background-color: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    padding: 20px;
    margin-top: 20px;
`;

const EditModeHeader = styled.div`
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-primary);

    h3 {
        margin: 0;
        font-size: 18px;
        color: var(--text-heading);
    }
`;

const FormRow = styled.div`
    display: flex;
    gap: 15px;
    margin-bottom: 15px;

    &:last-child {
        margin-bottom: 0;
    }

    @media (max-width: 768px) {
        flex-direction: column;
        gap: 0;
    }
`;

const FormGroup = styled.div`
    flex: 1;

    label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: var(--text-secondary);
    }

    input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-secondary);
        border-radius: 4px;
        font-size: 14px;
        background-color: var(--bg-input);
        color: var(--text-primary);

        &:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
    }
`;

const CheckboxGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 15px;

    input[type='checkbox'] {
        width: 16px;
        height: 16px;
        accent-color: var(--accent-primary);
    }

    label {
        font-size: 14px;
        color: var(--text-primary);
        cursor: pointer;
    }
`;

const FormActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border-tertiary);
`;

const SecondaryButton = styled.button`
    padding: 8px 16px;
    background-color: var(--button-secondary);
    color: var(--button-secondary-text);
    border: 1px solid var(--button-secondary-border);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        background-color: var(--button-secondary-hover);
        border-color: var(--button-secondary-border-hover);
    }
`;

const DangerButton = styled.button`
    padding: 8px 16px;
    background-color: var(--button-danger);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        background-color: var(--button-danger-hover);
    }
`;

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
                    <Link
                        to="/"
                        className="secondary-btn"
                        title="Back to Main UI"
                    >
                        ↩️
                    </Link>
                </div>
            </Header>

            <ConnectionsManager>
                <h2>Settings</h2>

                <SettingsSection>
                    <h3>Appearance</h3>
                    <SettingItem>
                        <SettingInfo>
                            <label>Theme</label>
                            <span className="description">
                                Choose your preferred color theme
                            </span>
                        </SettingInfo>
                        <SettingControl>
                            <ThemeSelector>
                                <ThemeOption
                                    $active={currentTheme === 'light'}
                                    onClick={() => handleThemeChange('light')}
                                >
                                    ☀️ Light
                                </ThemeOption>
                                <ThemeOption
                                    $active={currentTheme === 'dark'}
                                    onClick={() => handleThemeChange('dark')}
                                >
                                    🌙 Dark
                                </ThemeOption>
                            </ThemeSelector>
                        </SettingControl>
                    </SettingItem>
                </SettingsSection>

                <h2>Redis Connections Manager</h2>

                <ConnectionsList id="connections-container">
                    <h3>Available Connections</h3>
                    <div id="connections-list">
                        {connections.length === 0 ? (
                            <p>No connections configured.</p>
                        ) : (
                            connections.map((conn) => (
                                <ConnectionCard key={conn.id}>
                                    <ConnectionDetails>
                                        <strong>{conn.id}</strong>
                                        <div>
                                            {conn.host}:{conn.port}
                                            {conn.tls ? ' (TLS)' : ''}
                                            {conn.cluster ? ' (Cluster)' : ''}
                                        </div>
                                    </ConnectionDetails>
                                    <ConnectionActions>
                                        <SecondaryButton
                                            onClick={() => handleEdit(conn)}
                                        >
                                            Edit
                                        </SecondaryButton>
                                        <DangerButton
                                            onClick={() =>
                                                handleDelete(conn.id)
                                            }
                                        >
                                            Delete
                                        </DangerButton>
                                    </ConnectionActions>
                                </ConnectionCard>
                            ))
                        )}
                    </div>
                    <AddConnectionButton onClick={handleAddNew}>
                        Add New Connection
                    </AddConnectionButton>
                </ConnectionsList>

                {isEditing && editingConnection && (
                    <ConnectionFormComponent
                        connection={editingConnection}
                        onSave={handleSave}
                        onTest={handleTest}
                        onCancel={() => {
                            setIsEditing(false);
                            setEditingConnection(null);
                        }}
                    />
                )}
            </ConnectionsManager>

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

function ConnectionFormComponent({
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
        <StyledConnectionForm id="connection-form-container">
            <EditModeHeader>
                <h3>
                    {connection.id ? 'Edit Connection' : 'Add New Connection'}
                </h3>
            </EditModeHeader>

            <form id="connection-form" onSubmit={handleSubmit}>
                <FormRow>
                    <FormGroup>
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
                    </FormGroup>
                </FormRow>

                <FormRow>
                    <FormGroup>
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
                    </FormGroup>
                    <FormGroup>
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
                    </FormGroup>
                </FormRow>

                <FormRow>
                    <FormGroup>
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
                    </FormGroup>
                    <FormGroup>
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
                    </FormGroup>
                </FormRow>

                <CheckboxGroup>
                    <input
                        type="checkbox"
                        id="connection-tls"
                        checked={formData.tls}
                        onChange={(e) =>
                            setFormData({ ...formData, tls: e.target.checked })
                        }
                    />
                    <label htmlFor="connection-tls">Use TLS/SSL</label>
                </CheckboxGroup>
                <CheckboxGroup>
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
                </CheckboxGroup>

                <FormActions>
                    <button type="submit">Save Connection</button>
                    <SecondaryButton
                        type="button"
                        onClick={() => onTest(formData)}
                    >
                        Test Connection
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={onCancel}>
                        Cancel
                    </SecondaryButton>
                </FormActions>
            </form>
        </StyledConnectionForm>
    );
}
