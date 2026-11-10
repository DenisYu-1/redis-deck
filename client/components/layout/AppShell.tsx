import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toast } from '@/components/ui/Toast';
import { loadEnvironments } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';

/** Sidebar + scrolling main. Also loads connections once for every page. */
export function AppShell() {
    const { setConnections, setCurrentEnvironment, setIsLoading } =
        useAppStore();
    useTheme(); // applies the stored theme on startup

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        loadEnvironments()
            .then((conns) => {
                if (cancelled) return;
                setConnections(conns);
                const current = useAppStore.getState().currentEnvironment;
                if (!conns.some((c) => c.id === current)) {
                    setCurrentEnvironment(conns[0]?.id ?? '');
                }
            })
            .catch((error: unknown) => {
                showToast('Failed to load connections', 'error');
                console.error('Error loading connections:', error);
            })
            .finally(() => !cancelled && setIsLoading(false));
        return () => {
            cancelled = true;
        };
    }, [setConnections, setCurrentEnvironment, setIsLoading]);

    return (
        <div className="app">
            <Sidebar />
            <div className="main scroll">
                <Outlet />
            </div>
            <Toast />
        </div>
    );
}
