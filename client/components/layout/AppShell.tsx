import { useEffect, useState } from 'react';
import { Welcome } from '@/pages/Welcome/Welcome';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ProdBanner } from './ProdBanner';
import { Toast } from '@/components/ui/Toast';
import { loadEnvironments } from '@/services/apiService';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';

/** Sidebar + scrolling main. Also loads connections once for every page. */
export function AppShell() {
    const { setConnections, setCurrentEnvironment, setIsLoading } =
        useAppStore();
    const connections = useAppStore((s) => s.connections);
    const [loaded, setLoaded] = useState(false);
    useTheme(); // applies the stored theme on startup

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        loadEnvironments()
            .then((conns) => {
                if (cancelled) return;
                setConnections(conns);
                setLoaded(true);
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

    const welcome = loaded && connections.length === 0;

    return (
        <div className={`app ${welcome ? 'bare' : ''}`}>
            {!welcome && <Sidebar />}
            <div className="main scroll">
                {welcome ? (
                    <Welcome />
                ) : (
                    <>
                        <ProdBanner />
                        <Outlet />
                    </>
                )}
            </div>
            <Toast />
        </div>
    );
}
