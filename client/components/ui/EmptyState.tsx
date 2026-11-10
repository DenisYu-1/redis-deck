import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
    return (
        <div className="empty">
            <h3>{title}</h3>
            {children && <p>{children}</p>}
            {action}
        </div>
    );
}
