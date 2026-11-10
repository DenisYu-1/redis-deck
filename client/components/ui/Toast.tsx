import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastItem } from '@/utils/toast';

export function Toast() {
    const [items, setItems] = useState<ToastItem[]>([]);

    useEffect(() => subscribeToasts(setItems), []);

    return (
        <div className="toasts" role="status" aria-live="polite">
            {items.map((t) => (
                <div
                    key={t.id}
                    className={`toast-item ${t.type === 'error' ? 'error' : ''}`}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}
