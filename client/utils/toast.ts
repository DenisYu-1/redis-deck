import type { ToastMessage } from '@/types';

export interface ToastItem extends ToastMessage {
    id: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DURATION_MS = 3000;
let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
    listeners.forEach((l) => l(toasts));
}

export function subscribeToasts(listener: Listener): () => void {
    listeners.add(listener);
    listener(toasts);
    return () => {
        listeners.delete(listener);
    };
}

export function showToast(
    message: string,
    type: ToastMessage['type'] = 'info'
): void {
    const id = nextId++;
    toasts = [...toasts, { id, message, type }];
    emit();
    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        emit();
    }, DURATION_MS);
}
