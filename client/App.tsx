import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { KeySearch } from '@/components/KeySearch/KeySearch';
import { KeyList } from '@/components/KeyList/KeyList';
import { KeyDetails } from '@/components/KeyDetails/KeyDetails';
import { Toast } from '@/components/common/Toast';
import { useAppStore } from '@/store/useAppStore';

export function App() {
    const [searchPattern, setSearchPattern] = useState('*');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { connections, setSelectedKey } = useAppStore();

    const hasConnections = connections.length > 0;

    const handleSearch = (pattern: string) => {
        setSearchPattern(pattern);
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleShowAll = () => {
        setSearchPattern('*');
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleKeySelect = (key: string) => {
        setSelectedKey(key);
    };

    const handleOperationComplete = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

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
                    <KeyList
                        key={refreshTrigger}
                        searchPattern={searchPattern}
                        onKeySelect={handleKeySelect}
                    />
                    <KeyDetails onOperationComplete={handleOperationComplete} />
                </div>
            </main>
            <Toast />
        </div>
    );
}
