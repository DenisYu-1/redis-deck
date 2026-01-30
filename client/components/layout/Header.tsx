import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { useAppStore } from '@/store/useAppStore';
import { loadEnvironments } from '@/services/apiService';
import { useToast } from '@/hooks/useToast';

interface HeaderProps {
    children?: React.ReactNode;
    showNavigation?: boolean;
    showBackButton?: boolean;
}

export function Header({ children, showNavigation = true, showBackButton = false }: HeaderProps) {
    const {
        connections,
        currentEnvironment,
        setConnections,
        setCurrentEnvironment,
        setIsLoading,
        isLoading,
    } = useAppStore();
    const { showToast } = useToast();

    // Load environments globally - this ensures they're available for all pages
    useEffect(() => {
        if (connections.length === 0 && !isLoading) {
            const fetchConnections = async () => {
                setIsLoading(true);
                try {
                    const conns = await loadEnvironments();
                    setConnections(conns);
                    if (conns.length > 0 && !currentEnvironment) {
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
        }
    }, []);
    return (
        <header>
            <div className="logo-container">
                <Link to="/" title="Home">
                    <Logo />
                </Link>
            </div>
            {children}
            <div className="redis-info-button">
                {showBackButton && (
                    <Link
                        to="/"
                        className="secondary-btn"
                        title="Back to Main"
                    >
                        ↩️
                    </Link>
                )}
                {showNavigation && (
                    <>
                        <Link
                            to="/statistics"
                            className="secondary-btn"
                            title="Statistics"
                        >
                            📊
                        </Link>
                        <Link
                            to="/settings"
                            className="secondary-btn"
                            title="Settings"
                        >
                            ⚙️
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
}
