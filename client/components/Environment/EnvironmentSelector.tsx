import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { loadEnvironments, testConnection } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { RedisConnection } from '@/types';

export function EnvironmentSelector() {
    const {
        connections,
        currentEnvironment,
        setConnections,
        setCurrentEnvironment
    } = useAppStore();
    const [totalKeys, setTotalKeys] = useState<string>('Loading...');
    const { showToast } = useToast();

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const conns = await loadEnvironments();
                setConnections(conns);
                if (conns.length > 0 && !currentEnvironment) {
                    setCurrentEnvironment(conns[0]?.id ?? '');
                }
            } catch (error) {
                showToast('Failed to load connections', 'error');
                console.error('Error loading connections:', error);
            }
        };

        void fetchConnections();
    }, [currentEnvironment, setConnections, setCurrentEnvironment, showToast]);

    const handleEnvironmentChange = async (
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const newEnv = event.target.value;
        setCurrentEnvironment(newEnv);

        try {
            const isConnected = await testConnection(newEnv);
            if (!isConnected) {
                showToast('Connection failed', 'error');
                setTotalKeys('N/A');
            }
        } catch (error) {
            showToast('Error testing connection', 'error');
            console.error('Connection test error:', error);
        }
    };

    return (
        <div
            className="connection-info"
            style={{ display: connections.length > 0 ? 'flex' : 'none' }}
        >
            <div className="environment-selector">
                <label htmlFor="environment-select">Environment:</label>
                <select
                    id="environment-select"
                    value={currentEnvironment ?? ''}
                    onChange={handleEnvironmentChange}
                >
                    {connections.map((conn: RedisConnection) => (
                        <option key={conn.id} value={conn.id}>
                            {conn.id}
                        </option>
                    ))}
                </select>
            </div>
            <span id="total-keys-count" className="total-keys">
                Total Keys: {totalKeys}
            </span>
        </div>
    );
}
