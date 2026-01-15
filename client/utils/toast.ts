import type { ToastMessage } from '@/types';

export function showToast(
    message: string,
    type: ToastMessage['type'] = 'info'
): void {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
