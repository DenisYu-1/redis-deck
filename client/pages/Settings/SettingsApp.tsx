import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Toast } from '@/components/common/Toast';
import { setTheme, getTheme } from '@/utils/theme';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';
import {
    loadEnvironments,
    addConnection,
    updateConnection,
    deleteConnection,
    testConnectionConfig
} from '@/services/apiService';
import type { RedisConnection } from '@/types';
import {
    ConnectionsManager,
    SettingsSection,
    SettingItem,
    SettingInfo,
    SettingControl,
    ThemeSelector,
    ThemeOption,
    ConnectionsList,
    ConnectionCard,
    ConnectionDetails,
    ConnectionActions,
    AddConnectionButton,
    StyledConnectionForm,
    EditModeHeader,
    FormRow,
    FormGroup,
    CheckboxGroup,
    FormActions,
    SecondaryButton,
    DangerButton
} from './SettingsApp.styles';

export function SettingsApp() {
    const [connections, setConnections] = useState<RedisConnection[]>([]);
    const [currentTheme, setCurrentTheme] = useState(getTheme());
    const [isEditing, setIsEditing] = useState(false);
    const [editingConnection, setEditingConnection] =
        useState<RedisConnection | null>(null);
    const {
        setConnections: setGlobalConnections,
        currentEnvironment,
        setCurrentEnvironment
    } = useAppStore();
    const { showToast } = useToast();

    const fetchConnections = async () => {
        try {
            const conns = await loadEnvironments();
            setConnections(conns);
            setGlobalConnections(conns);
            if (
                currentEnvironment &&
                !conns.some((conn) => conn.id === currentEnvironment)
            ) {
                setCurrentEnvironment(conns[0]?.id ?? '');
            }
        } catch (error) {
            showToast('Error loading connections', 'error');
            console.error('Error loading connections:', error);
        }
    };

    useEffect(() => {
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
            await fetchConnections();
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
            const result = await testConnectionConfig(connection);
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
            <Header showNavigation={true} showBackButton={true}>
                <div className="connection-info">
                    <span
                        id="total-keys-count"
                        className="total-keys"
                        style={{ display: 'none' }}
                    >
                        Total Keys: N/A
                    </span>
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

    useEffect(() => {
        setFormData(connection);
    }, [connection]);

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
