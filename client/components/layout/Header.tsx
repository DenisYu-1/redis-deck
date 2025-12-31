import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';

interface HeaderProps {
    children?: React.ReactNode;
    showNavigation?: boolean;
}

export function Header({ children, showNavigation = true }: HeaderProps) {
    return (
        <header>
            <div className="logo-container">
                <Link to="/" title="Home">
                    <Logo />
                </Link>
            </div>
            {children}
            {showNavigation && (
                <div className="redis-info-button">
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
                </div>
            )}
        </header>
    );
}
