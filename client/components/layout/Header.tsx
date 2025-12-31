import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';

interface HeaderProps {
    children?: React.ReactNode;
    showNavigation?: boolean;
    showBackButton?: boolean;
}

export function Header({ children, showNavigation = true, showBackButton = false }: HeaderProps) {
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
