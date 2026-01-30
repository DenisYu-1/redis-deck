import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { testConnection, getKeyCount } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { RedisConnection } from '@/types';

export function EnvironmentSelector() {
    const { connections, currentEnvironment, setCurrentEnvironment } =
        useAppStore();
    const [totalKeys, setTotalKeys] = useState<string>('Loading...');
    const { showToast } = useToast();

    useEffect(() => {
        const fetchKeyCount = async () => {
            if (!currentEnvironment) {
                setTotalKeys('N/A');
                return;
            }

            try {
                const result = await getKeyCount(currentEnvironment);
                setTotalKeys(result.count.toLocaleString());
            } catch (error) {
                console.error('Error fetching key count:', error);
                setTotalKeys('N/A');
            }
        };

        void fetchKeyCount();
    }, [currentEnvironment]);

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
