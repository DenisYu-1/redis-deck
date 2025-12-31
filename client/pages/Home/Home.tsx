import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { KeySearch } from '@/components/KeySearch/KeySearch';
import { KeyList } from '@/components/KeyList/KeyList';
import { KeyDetails } from '@/components/KeyDetails/KeyDetails';
import { Toast } from '@/components/common/Toast';
import { PluginContainer } from '@/plugins/PluginContainer';
import { usePlugins } from '@/plugins/usePlugins';
import { useAppStore } from '@/store/useAppStore';
import { loadEnvironments } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';
import type { PluginContext } from '@/types';

export function Home() {
    const [searchPattern, setSearchPattern] = useState('*');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const {
        connections,
        currentEnvironment,
        setConnections,
        setCurrentEnvironment,
        setSelectedKey,
        setIsLoading,
        isLoading,
    } = useAppStore();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchConnections = async () => {
            setIsLoading(true);
            try {
                const conns = await loadEnvironments();
                setConnections(conns);
                if (conns.length > 0) {
                    setCurrentEnvironment(conns[0]?.id ?? '');
                }
            } catch (error) {
                showToast('Failed to load connections', 'error');
                console.error('Error loading connections:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchConnections();
    }, [setConnections, setCurrentEnvironment, setIsLoading, showToast]);

    const hasConnections = connections.length > 0;

    const handleSearch = (pattern: string) => {
        setSearchPattern(pattern);
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleShowAll = () => {
        setSearchPattern('*');
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleOperationComplete = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    const pluginContext: PluginContext = {
        getCurrentEnvironment: () => currentEnvironment ?? '',
        onOperationComplete: handleOperationComplete,
        showToast: (
            message: string,
            type: 'success' | 'error' | 'warning' | 'info'
        ) => {
            showToast(message, type);
        }
    };

    const { emit } = usePlugins(pluginContext);

    const handleKeySelect = (key: string) => {
        setSelectedKey(key);
        // Emit event so plugins know a key was selected
        emit({
            type: 'keys:selected',
            payload: { keys: [key] },
            source: 'app'
        });
    };

    if (isLoading) {
        return <></>;
    }

    if (!hasConnections) {
        return (
            <div className="container">
                <Header showNavigation={true}>
                    <div
                        className="connection-info"
                        style={{ display: 'none' }}
                    />
                </Header>
                <main>
                    <EmptyState />
                </main>
                <Toast />
            </div>
        );
    }

    return (
        <div className="container">
            <Header showNavigation={true}>
                <EnvironmentSelector />
            </Header>
            <main>
                <KeySearch onSearch={handleSearch} onShowAll={handleShowAll} />
                <div className="results-area">
                    <div className="key-row">
                        <KeyList
                            key={refreshTrigger}
                            searchPattern={searchPattern}
                            onKeySelect={handleKeySelect}
                        />
                        <KeyDetails
                            onOperationComplete={handleOperationComplete}
                        />
                    </div>
                    <PluginContainer context={pluginContext} />
                </div>
            </main>
            <Toast />
        </div>
    );
}
