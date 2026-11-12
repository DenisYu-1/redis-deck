import { useEffect, useId, useState, type ReactNode } from 'react';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

// Open modals, oldest first; only the last one reacts to Escape.
const stack: symbol[] = [];

export function Modal({ title, onClose, children, footer }: ModalProps) {
    const titleId = useId();

    const [token] = useState(() => Symbol('modal'));
    useEffect(() => {
        stack.push(token);
        return () => {
            stack.splice(stack.indexOf(token), 1);
        };
    }, [token]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && stack[stack.length - 1] === token) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, token]);

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
