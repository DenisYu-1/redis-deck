import { useCallback } from 'react';
import { showToast as showToastUtil } from '@/utils/toast';
import type { ToastMessage } from '@/types';

export function useToast() {
    const showToast = useCallback(
        (message: string, type: ToastMessage['type'] = 'info') => {
            showToastUtil(message, type);
        },
        []
    );

    return { showToast };
}
