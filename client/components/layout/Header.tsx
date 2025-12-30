import { Logo } from '@/components/common/Logo';

interface HeaderProps {
    children?: React.ReactNode;
    showNavigation?: boolean;
}

export function Header({ children, showNavigation = true }: HeaderProps) {
    return (
        <header>
            <div className="logo-container">
                <Logo />
            </div>
            {children}
            {showNavigation && (
                <div className="redis-info-button">
                    <a
                        href="/statistics.html"
                        className="secondary-btn"
                        title="Statistics"
                    >
                        📊
                    </a>
                    <a
                        href="/settings.html"
                        className="secondary-btn"
                        title="Settings"
                    >
                        ⚙️
                    </a>
                </div>
            )}
        </header>
    );
}
