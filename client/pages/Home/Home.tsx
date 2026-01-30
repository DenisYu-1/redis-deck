import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { EnvironmentSelector } from '@/components/Environment/EnvironmentSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Toast } from '@/components/common/Toast';
import { LeftPanel } from '@/components/layout/LeftPanel';
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

    const {
        plugins,
        emit,
        isLoading: isLoadingPlugins
    } = usePlugins(pluginContext);

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
            unsubscribeToast();
        };
    }, [showToast]);

    return (
        <div className="container">
            <Header showNavigation={true} showBackButton={false}>
                {!isLoading && hasConnections && <EnvironmentSelector />}
            </Header>
            <main className="home-layout">
                {!isLoading && hasConnections && (
                    <>
                        <LeftPanel
                            plugins={plugins}
                            context={pluginContext}
                            emit={emit}
                        />
                        <div className="home-content">
                            <PluginContainer
                                context={pluginContext}
                                plugins={plugins}
                                emit={emit}
                                isLoading={isLoadingPlugins}
                            />
                        </div>
                    </>
                )}
                {!isLoading && !hasConnections && <EmptyState />}
            </main>
            <Toast />
        </div>
    );
}
