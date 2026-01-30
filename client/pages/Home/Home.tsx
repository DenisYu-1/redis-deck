import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Toast } from '@/components/common/Toast';
import { PluginContainer } from '@/plugins/PluginContainer';
import { usePlugins } from '@/plugins/usePlugins';
import { eventBus } from '@/plugins/eventBus';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/useToast';
import type { PluginContext } from '@/types';

export function Home() {
    const { connections, isLoading, currentEnvironment } = useAppStore();
    const { showToast } = useToast();

    const hasConnections = connections.length > 0;

    const pluginContext: PluginContext = {
        getCurrentEnvironment: () => currentEnvironment ?? '',
        onOperationComplete: () => {
            // Operation completed - plugins will handle this
        },
        showToast: (
            message: string,
            type: 'success' | 'error' | 'warning' | 'info'
        ) => {
            showToast(message, type);
        }
    };

    usePlugins(pluginContext);

    // Listen for plugin events
    useEffect(() => {
        const handlePluginEvents = (event: any) => {
            if (event.type === 'toast:show') {
                const { message, type } = event.payload;
                showToast(message, type);
            }
        };

        // Subscribe to the event bus for plugin events
        const unsubscribeToast = eventBus.on('toast:show', handlePluginEvents);

        return () => {
            unsubscribeToast?.();
        };
    }, [showToast]);

    if (isLoading) {
        return <></>;
    }

    if (!hasConnections) {
        return (
            <div className="container">
                <Header showNavigation={true} showBackButton={false}>
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
            <Header showNavigation={true} showBackButton={false}>
                <EnvironmentSelector />
            </Header>
            <main>
                <PluginContainer context={pluginContext} />
            </main>
            <Toast />
        </div>
    );
}
