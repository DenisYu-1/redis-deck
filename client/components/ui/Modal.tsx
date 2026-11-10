import { useEffect, useId, type ReactNode } from 'react';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
    const titleId = useId();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="scrim"
            data-testid="modal-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="db">
                    <h2 id={titleId}>{title}</h2>
                    {children}
                </div>
                {footer && <div className="df">{footer}</div>}
            </div>
        </div>
    );
}
